import {
  type CalendarDate,
  addCalendarDays,
  assertCalendarDate,
  compareCalendarDates,
  eachCalendarDay,
} from "@/lib/dates";

/**
 * Who is around, derived from what people have said.
 *
 * Presence is a stretch of days and a state rather than a status field on a person, and every
 * question the board asks falls out of that one shape: who is around today, who arrives or leaves
 * this month, and when all five are next together. A status field would answer only the first,
 * and would need updating by hand the moment it changed.
 *
 * **AROUND means "with the family", not "at home" and not "free".** The whole gathering countdown
 * rests on that reading — see the comment on the enum in `schema.prisma`. Under the other reading
 * five independent yeses would be rendered as one shared fact.
 *
 * A day nothing covers is *unsaid*, and resolves to `null`. There is no fallback to where a
 * person usually is: the board would then be answering "is everyone together" with a fact nobody
 * stated, and a countdown built on that is wrong in exactly the case anybody would act on. That
 * rule survived the retirement of `Place` unchanged.
 *
 * These functions take plain objects rather than Prisma rows so the logic is testable without a
 * database — the caller maps rows to `PresenceWindow` at the boundary.
 */

/** Mirrors the `PresenceState` enum, as a plain union so this module needs no generated import. */
export type PresenceState = "AROUND" | "AWAY";

export interface PresenceWindow {
  profileId: string;
  state: PresenceState;
  startsOn: CalendarDate;
  /** Last day this holds. `null` means open-ended — it stands until they say otherwise. */
  endsOn: CalendarDate | null;
  /** Free text shown beside the run. Never compared — see the note on the column. */
  note: string | null;
}

export interface Gathering {
  date: CalendarDate;
}

/**
 * Does this row cover the given day?
 *
 * `endsOn` is inclusive — it is the last day the statement holds, not the day it stops. A
 * single-day run therefore has `startsOn === endsOn`, which is what someone painting one cell on
 * the strip expects.
 */
export function coversDate(
  window: PresenceWindow,
  date: CalendarDate,
): boolean {
  const day = assertCalendarDate(date, "date");
  if (compareCalendarDates(window.startsOn, day) > 0) return false;
  if (window.endsOn === null) return true;
  return compareCalendarDates(day, window.endsOn) <= 0;
}

/**
 * Each profile's state on a given day, or `null` where nothing has been said.
 *
 * Overlapping rows for one person should not exist — `setDays` normalizes every write — but
 * the board still has to render something if one ever does. The most recently started run wins,
 * on the theory that it is the more recent statement of intent; exact `startsOn` ties are broken
 * by input order, so callers ordering by `createdAt` get last-write-wins.
 */
export function statesOn(
  windows: readonly PresenceWindow[],
  profileIds: readonly string[],
  date: CalendarDate,
): Map<string, PresenceState | null> {
  return new Map(
    Array.from(coveringOn(windows, profileIds, date), ([profileId, window]) => [
      profileId,
      window?.state ?? null,
    ]),
  );
}

/**
 * Each profile's governing row on a given day, or `null` where nothing has been said.
 *
 * The same resolution `statesOn` performs, but handing back the whole row — the board shows not
 * only whether somebody is around but until when, and that needs `endsOn` and `note`. `statesOn`
 * is defined in terms of this so the tie-breaking rule exists in exactly one place; two copies
 * would be free to disagree about which run wins, and the board would then contradict itself
 * about a person's state and their end date.
 */
export function coveringOn(
  windows: readonly PresenceWindow[],
  profileIds: readonly string[],
  date: CalendarDate,
): Map<string, PresenceWindow | null> {
  const day = assertCalendarDate(date, "date");
  const wanted = new Set(profileIds);
  const best = new Map<string, PresenceWindow>();

  for (const window of windows) {
    if (!wanted.has(window.profileId)) continue;
    if (!coversDate(window, day)) continue;
    const incumbent = best.get(window.profileId);
    // `>= 0` rather than `> 0`: on an exact tie the later element replaces the earlier one.
    if (
      !incumbent ||
      compareCalendarDates(window.startsOn, incumbent.startsOn) >= 0
    ) {
      best.set(window.profileId, window);
    }
  }

  return new Map(
    profileIds.map((profileId) => [profileId, best.get(profileId) ?? null]),
  );
}

/**
 * One person's days, laid out flat: what each of `count` days from `from` says.
 *
 * The strip and the board's grid are both *projections* of the ranges, computed on demand rather
 * than stored. That is the whole reason a range survived as the storage shape — "at school until
 * told otherwise" stays one row, and nothing has to keep a materialised horizon from expiring.
 *
 * Lives here rather than beside either surface because both need it and neither owns it. It used
 * to sit in the web strip's `"use client"` module, which the server page then tried to call
 * across the boundary — a runtime error that no test could have caught, because the function
 * itself was perfectly correct.
 */
export function projectDays(
  windows: readonly PresenceWindow[],
  profileId: string,
  from: CalendarDate,
  count: number,
): { date: CalendarDate; state: PresenceState | null; note: string | null }[] {
  const start = assertCalendarDate(from, "from");
  return Array.from({ length: Math.max(0, count) }, (_, offset) => {
    const date = addCalendarDays(start, offset);
    const covering =
      coveringOn(windows, [profileId], date).get(profileId) ?? null;
    return {
      date,
      state: covering?.state ?? null,
      note: covering?.note ?? null,
    };
  });
}

/**
 * The next day every profile is AROUND, searching forward from `from`.
 *
 * Declines while anybody is unsaid. Silence is not a yes anywhere in this app, and a countdown
 * that treated it as one would be confidently wrong on the one date people would act on — the
 * board names who it is waiting for instead, which is the difference between a gap in the data
 * and a guess about it.
 *
 * Walks the horizon a day at a time. With five people and a year to scan this is a few thousand
 * comparisons, so an interval-intersection algorithm would buy nothing but a place for an
 * off-by-one to hide.
 */
export function findNextGathering(
  windows: readonly PresenceWindow[],
  profileIds: readonly string[],
  from: CalendarDate,
  horizonDays = 365,
): Gathering | null {
  // Vacuously true is the wrong answer here: with nobody to gather, there is no gathering. The
  // `every` below already declines on an empty roster only by accident of returning true, so
  // this is an explicit statement of intent and an early exit rather than the only thing
  // preventing a countdown to an empty family.
  if (profileIds.length === 0) return null;

  const start = assertCalendarDate(from, "from");
  if (horizonDays < 0) return null;

  for (const day of eachCalendarDay(
    start,
    addCalendarDays(start, horizonDays),
  )) {
    const states = statesOn(windows, profileIds, day);
    let together = true;
    for (const state of states.values()) {
      if (state !== "AROUND") {
        together = false;
        break;
      }
    }
    if (together) return { date: day };
  }

  return null;
}

/**
 * Who has not said anything about a given day, in the order they were asked for.
 *
 * This is what lets the lede report "waiting on Macy" instead of going silent. The countdown
 * still declines — that rule is unchanged — but declining without saying why is how the board
 * ended up with two headline sections that never said anything.
 */
export function unsaidOn(
  windows: readonly PresenceWindow[],
  profileIds: readonly string[],
  date: CalendarDate,
): string[] {
  const states = statesOn(windows, profileIds, date);
  return profileIds.filter((profileId) => states.get(profileId) == null);
}

/**
 * How far ahead somebody has said anything, counting from `from`.
 *
 * Three answers, and they are genuinely three rather than a date that is sometimes missing:
 *
 * - `unsaid` — nothing covers `from` at all. A run that ended last week does not count, and
 *   neither does one starting next month: the question the strip asks is "how far ahead have you
 *   told us", not "when did you last touch this".
 * - `through` — said without a gap up to and including that day.
 * - `open` — the chain runs into a run with no last day. There is no date to report, and that is
 *   the *most* complete answer rather than the absence of one.
 *
 * One function rather than a date plus a boolean the caller derives separately. The two would be
 * free to disagree, and the way they disagreed was instructive: "is there an open-ended run
 * covering today" is not the same question as "does the chain from today reach one", so somebody
 * away at school who comes home for a weekend — an away run, then the weekend, then an open-ended
 * away run — read as having said nothing at all.
 *
 * Walking rather than taking `max(endsOn)`: a gap in the middle means the answer is the end of
 * the *first* run, not the last. Somebody who has said this weekend and next Christmas has not
 * said through Christmas.
 */
export type Horizon =
  | { kind: "unsaid" }
  | { kind: "through"; date: CalendarDate }
  | { kind: "open" };

export function horizonFrom(
  windows: readonly PresenceWindow[],
  profileId: string,
  from: CalendarDate,
): Horizon {
  const mine = windows
    .filter((window) => window.profileId === profileId)
    .sort((a, b) => compareCalendarDates(a.startsOn, b.startsOn));

  let reached: CalendarDate | null = null;
  let cursor = assertCalendarDate(from, "from");

  for (const window of mine) {
    if (
      window.endsOn !== null &&
      compareCalendarDates(window.endsOn, cursor) < 0
    ) {
      continue;
    }
    // The first run that does not reach the cursor leaves a gap, and the answer stops there.
    if (compareCalendarDates(window.startsOn, cursor) > 0) break;
    if (window.endsOn === null) return { kind: "open" };
    reached = window.endsOn;
    cursor = addCalendarDays(window.endsOn, 1);
  }

  return reached === null
    ? { kind: "unsaid" }
    : { kind: "through", date: reached };
}
