import {
  type CalendarDate,
  addCalendarDays,
  assertCalendarDate,
  compareCalendarDates,
} from "@/lib/dates";
import type { PresenceState } from "@/lib/presence/derive";

/**
 * Setting days on somebody's calendar.
 *
 * The strip is the whole point of this feature: you tap the days you mean and say what they are.
 * Everything those days land on has to give way — a day you set is a statement you have replaced,
 * not one to reconcile with.
 *
 * So this is the write path's only rule, and it is a pure function over plain objects: rows in,
 * rows out, no Prisma, no dates that are `Date`s. `lib/board/service.ts` calls it inside a
 * transaction and writes whatever comes back.
 *
 * The invariant it establishes is that **one person's runs never overlap**, which is what makes
 * reading cheap: the strip renders by asking which single run covers each day. `coveringOn` in
 * `derive.ts` keeps a tie-break for overlaps anyway, because a guard that already exists and is
 * already tested is not worth deleting to prove an invariant holds.
 *
 * Storage is still a *range*, which is why `rewrite` deals in spans rather than days. That is what
 * lets a row say "until I say otherwise" — a thing no list of days can express, and the reason
 * `Presence.endsOn` is nullable. Nothing writes such a row today; everything reads one correctly,
 * including carving days out of the middle of it.
 */

export interface Run {
  /** Present for a row that already exists; absent for one this function is creating. */
  id?: string;
  state: PresenceState;
  startsOn: CalendarDate;
  /** Last day, inclusive. `null` is open-ended — it holds until something replaces it. */
  endsOn: CalendarDate | null;
  note: string | null;
}

export interface Plan {
  /** Ids of rows that no longer describe anything and should be deleted. */
  deleteIds: string[];
  /** Rows to write fresh. Existing rows are never updated in place — see below. */
  create: Run[];
}

/** A stretch of days to overwrite. `to: null` means "from `from` onwards, with no end". */
interface Span {
  from: CalendarDate;
  to: CalendarDate | null;
}

/**
 * The one operation: clear `spans` out of `existing`, put `inserts` in their place, and say what
 * to write.
 *
 * Everything else in this module is a way of describing the spans. Setting days and clearing them
 * are the same act — the second is the first with nothing to insert — and writing them as one
 * function is what stops the two from disagreeing about a fence post.
 *
 * Every run a span touches is deleted and re-created rather than updated in place. Updating would
 * be fewer statements, but a run overwritten through the middle becomes *two* rows, so the code
 * would need an update path and a create path and a delete path that each handle their own share
 * of the cases. Delete-and-recreate has one shape and one place for an off-by-one to be wrong, and
 * the volume is five people times a handful of rows.
 */
function rewrite(
  existing: readonly Run[],
  spans: readonly Span[],
  inserts: readonly Run[],
): Plan {
  // Survivors are the parts of existing runs no span covers, plus the runs nothing touched. A run
  // overwritten through the middle leaves a head and a tail, which is why one input row can
  // produce two entries here.
  let survivors: Run[] = [...existing];

  for (const span of spans) {
    const next: Run[] = [];
    for (const run of survivors) {
      if (!overlaps(run, span.from, span.to)) {
        next.push(run);
        continue;
      }

      // The head: the part of the old run before the span starts.
      if (compareCalendarDates(run.startsOn, span.from) < 0) {
        next.push({
          state: run.state,
          startsOn: run.startsOn,
          endsOn: addCalendarDays(span.from, -1),
          note: run.note,
        });
      }

      // The tail: the part after the span ends. An open-ended span has no after, and an
      // open-ended old run keeps its openness — the statement "until I say otherwise" survives
      // having a few days carved out of its front.
      if (
        span.to !== null &&
        (run.endsOn === null || compareCalendarDates(run.endsOn, span.to) > 0)
      ) {
        next.push({
          state: run.state,
          startsOn: addCalendarDays(span.to, 1),
          endsOn: run.endsOn,
          note: run.note,
        });
      }
    }
    survivors = next;
  }

  const merged = merge([...survivors, ...inserts]);

  // An id survives `merge` only on a row that came through whole: fragments are built fresh, and
  // merging two runs mints a new one. So an id still present in the output describes a row that
  // already says the right thing and needs no write, and an id that has gone describes one that
  // does not — whether it was split, absorbed, or replaced. Deriving the deletes from what came
  // *out* rather than from what was touched on the way is what keeps a merged-away row from being
  // left behind beside its own replacement.
  const kept = new Set(merged.map((run) => run.id).filter(Boolean));

  return {
    deleteIds: existing
      .filter((run) => run.id && !kept.has(run.id))
      .map((run) => run.id!),
    create: merged.filter((run) => !run.id),
  };
}

/**
 * Say what a set of days looks like, or take them back.
 *
 * The days need not be contiguous, and usually are not: the strip is a fortnight of individually
 * tappable cells, and "I'm around Friday, Saturday and the Tuesday after" is one act rather than
 * three. They are grouped into maximal runs here, so a weekend selected as two days is stored as
 * one row.
 *
 * A `null` state clears them, returning those days to unsaid. That is not a third state: an unsaid
 * day is the *absence* of a statement, and somebody who taps a day by mistake needs to undo the
 * fact rather than overwrite it with a different one.
 */
export function setDays(
  existing: readonly Run[],
  dates: readonly CalendarDate[],
  state: PresenceState | null,
  note: string | null,
): Plan {
  const runs = groupIntoRuns(dates);
  const spans = runs.map((run) => ({ from: run.from, to: run.to }));
  const inserts =
    state === null
      ? []
      : runs.map((run) => ({
          state,
          startsOn: run.from,
          endsOn: run.to,
          note,
        }));
  return rewrite(existing, spans, inserts);
}

/**
 * Loose days, sorted and collapsed into the fewest maximal runs that cover them.
 *
 * Duplicates are dropped rather than rejected — tapping a day twice is a slip, and a repeated
 * date would otherwise produce a zero-width second span.
 *
 * Exported for its tests: this is where a fence-post error would hide, and it is worth being able
 * to reach directly rather than only through `setDays`.
 */
export function groupIntoRuns(
  dates: readonly CalendarDate[],
): { from: CalendarDate; to: CalendarDate }[] {
  const sorted = [
    ...new Set(dates.map((date) => assertCalendarDate(date, "date"))),
  ].sort(compareCalendarDates);

  const runs: { from: CalendarDate; to: CalendarDate }[] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && addCalendarDays(last.to, 1) === date) {
      last.to = date;
      continue;
    }
    runs.push({ from: date, to: date });
  }
  return runs;
}

/** Does `run` share any day with `[from, to]`? A `null` end on either side means no upper bound. */
function overlaps(
  run: Run,
  from: CalendarDate,
  to: CalendarDate | null,
): boolean {
  if (to !== null && compareCalendarDates(run.startsOn, to) > 0) return false;
  if (run.endsOn !== null && compareCalendarDates(run.endsOn, from) < 0) {
    return false;
  }
  return true;
}

/**
 * Collapse runs that touch and say the same thing.
 *
 * Sorted first, because adjacency is only visible in order. Two runs merge when the second starts
 * the day after the first ends and both carry the same state and note — a different note is a
 * different statement ("Vanguard" then "spring break") and merging them would lose one.
 *
 * Exported for its tests: this is where a fence-post error would hide, and it is worth being able
 * to reach directly rather than only through `applyRange`.
 */
export function merge(runs: readonly Run[]): Run[] {
  const sorted = [...runs].sort((a, b) =>
    compareCalendarDates(a.startsOn, b.startsOn),
  );

  const out: Run[] = [];
  for (const run of sorted) {
    const previous = out[out.length - 1];
    if (
      previous &&
      previous.endsOn !== null &&
      previous.state === run.state &&
      previous.note === run.note &&
      addCalendarDays(previous.endsOn, 1) === run.startsOn
    ) {
      // The merged row is a new statement spanning both, so it keeps no id — whichever row lent
      // its dates, the surviving span is not the row that was there before.
      out[out.length - 1] = {
        state: previous.state,
        startsOn: previous.startsOn,
        endsOn: run.endsOn,
        note: previous.note,
      };
      continue;
    }
    out.push(run);
  }
  return out;
}
