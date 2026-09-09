import "server-only";

import { type AgendaEntry, buildAgenda } from "@/lib/board/agenda";
import { upcomingBirthdays } from "@/lib/board/birthdays";
import {
  type BoardPoll,
  GATHERING_HORIZON_DAYS,
  type FamilyMember,
  getEventsForWindow,
  getFamilyMembers,
  getPolls,
  getPresenceForWindow,
} from "@/lib/board/data";
import {
  type CalendarDate,
  differenceInCalendarDays,
  eachCalendarDay,
  addCalendarDays,
} from "@/lib/dates";
import { tallyPoll } from "@/lib/polls/tally";
import {
  type Horizon,
  type PresenceState,
  coveringOn,
  findNextGathering,
  horizonFrom,
  unsaidOn,
} from "@/lib/presence/derive";

/**
 * The board, assembled.
 *
 * Promoted out of `app/home/data.ts` when it gained a second consumer: `/home` renders it, and
 * `GET /api/v1/board` serialises it. That is the repository's own promotion rule — a route sidecar
 * that stops being route-private moves to `/lib` — and it costs nothing here because both
 * functions already took the actor as a plain argument.
 *
 * No auth here, in either direction. `page.tsx` and the route handler each establish who is asking
 * before calling in, which is what keeps this module composable.
 *
 * `today` is a required parameter rather than a default read from the clock. The reads underneath
 * are cached and keyed on their arguments, so a date resolved in here would be baked into the
 * cache entry and the board would still be showing yesterday tomorrow. The page reads the clock,
 * which it may — it is dynamic already because it reads the session.
 */

/** How far ahead "what's coming up" looks. A month is about as far as a family plans in detail. */
export const AGENDA_WINDOW_DAYS = 30;

/** How many days the board's grid draws. Matches the strip, so the two read as one artifact. */
export const GRID_DAYS = 14;

export interface MemberPresence {
  member: FamilyMember;
  /** `null` when nothing has been said about today, which is not the same as being away. */
  state: PresenceState | null;
  /** Last day the current run holds; `null` for an open-ended run or when nothing is said. */
  until: CalendarDate | null;
  /** The run's note — "Vanguard", "work trip" — when it carries one. */
  note: string | null;
}

export interface NextGathering {
  date: CalendarDate;
  /** Zero when it is today. */
  inDays: number;
}

/**
 * One person's fortnight, as cells.
 *
 * The grid is the board's resting state, and it replaced a list of five place names because the
 * list answered only "where is everyone right now" — a question that was almost always answered
 * "not recorded". Fourteen cells answer the planning question instead: you can see at a glance
 * where the family overlaps, who has run out of days, and which weekend is already spoken for.
 */
/** One day in the fortnight, for one person. */
export interface GridCell {
  /** `null` is unsaid, and drawn as a gap rather than as a third kind of mark. */
  state: PresenceState | null;
  /**
   * The run's note, carried per *cell* rather than per person.
   *
   * The board only ever draws the one covering today, so this looks redundant — it is here for
   * undo. Painting over a day deletes the statement that was there, note and all, and an undo
   * that restored the state but dropped the reason would quietly lose the only writing anybody
   * does in this app.
   */
  note: string | null;
}

export interface GridRow {
  member: FamilyMember;
  /** One entry per day from `today`, in order. */
  days: GridCell[];
  /**
   * How far ahead this person has spoken, counting from today without a gap.
   *
   * The grid shows a fortnight; this says whether they have run out of it. "Said through Sunday"
   * is a fact somebody can check against their own week, where fourteen dashed circles is a
   * picture they have to count.
   */
  horizon: Horizon;
}

export async function getBoardView(today: CalendarDate) {
  // Started together rather than awaited in sequence: they are independent, and three sequential
  // round trips would make the board's first paint the sum of them rather than the slowest.
  const [members, presenceRows, events] = await Promise.all([
    getFamilyMembers(),
    getPresenceForWindow(today, GATHERING_HORIZON_DAYS),
    getEventsForWindow(today, AGENDA_WINDOW_DAYS),
  ]);

  const profileIds = members.map((member) => member.profileId);

  // `coveringOn` rather than `statesOn`: the row reports not just whether somebody is around but
  // until when and why, and that needs the whole run.
  const covering = coveringOn(presenceRows, profileIds, today);
  const presence: MemberPresence[] = members.map((member) => {
    const run = covering.get(member.profileId) ?? null;
    return {
      member,
      state: run?.state ?? null,
      until: run?.endsOn ?? null,
      note: run?.note ?? null,
    };
  });

  const found = findNextGathering(
    presenceRows,
    profileIds,
    today,
    GATHERING_HORIZON_DAYS,
  );
  const gathering: NextGathering | null = found
    ? {
        date: found.date,
        inDays: differenceInCalendarDays(today, found.date),
      }
    : null;

  // Who the countdown is waiting on. The gathering still declines while anybody is unsaid — that
  // rule is untouched — but the board used to decline in silence, which is how it ended up with a
  // headline that never said anything. Naming them turns a dead section into an ask.
  const membersByProfileIdMap = new Map(
    members.map((member) => [member.profileId, member]),
  );
  const unsaidToday = unsaidOn(presenceRows, profileIds, today).map(
    (profileId) => membersByProfileIdMap.get(profileId)!,
  );

  // Resolved a day at a time and then transposed, rather than a person at a time: `statesOn`
  // scans every row it is given, so asking it per person per cell would walk the table seventy
  // times to fill fourteen columns.
  const gridDays = eachCalendarDay(
    today,
    addCalendarDays(today, GRID_DAYS - 1),
  );
  const byDay = gridDays.map((day) =>
    coveringOn(presenceRows, profileIds, day),
  );
  const grid: GridRow[] = members.map((member) => ({
    member,
    days: byDay.map((covering) => {
      const run = covering.get(member.profileId) ?? null;
      return { state: run?.state ?? null, note: run?.note ?? null };
    }),
    horizon: horizonFrom(presenceRows, member.profileId, today),
  }));

  const agenda: AgendaEntry[] = buildAgenda({
    birthdays: upcomingBirthdays(
      members
        .filter((member) => member.birthday !== null)
        .map((member) => ({
          profileId: member.profileId,
          birthday: member.birthday!,
        })),
      today,
      AGENDA_WINDOW_DAYS,
    ),
    events,
  });

  return {
    today,
    presence,
    gathering,
    unsaidToday,
    grid,
    gridDays,
    agenda,
    // A lookup the agenda needs to render a name where it holds an id. A plain object rather than
    // a Map so this shape stays trivially serializable if a client component ever needs it.
    membersByProfileId: Object.fromEntries(
      members.map((member) => [member.profileId, member]),
    ) as Record<string, FamilyMember>,
  };
}

export type BoardView = Awaited<ReturnType<typeof getBoardView>>;

/**
 * Live asks this person has not finished answering.
 *
 * Read separately from `getBoardView` rather than folded into it, because it is the one thing on
 * the board that depends on *who is looking*. Threading a viewer through the board view would
 * make every one of its cached reads per-person for the sake of a single line.
 *
 * "Live" is `closesOn`, which is written at creation. It used to be derived from the option dates
 * — a poll whose days had passed stopped nagging on its own — and that stopped working the moment
 * an option could be "tacos". This is the only thing in the app that nags, so something has to
 * close it.
 */
export async function getPollsAwaiting(
  profileId: string,
  today: CalendarDate,
): Promise<BoardPoll[]> {
  const [polls, members] = await Promise.all([getPolls(), getFamilyMembers()]);
  const profileIds = members.map((member) => member.profileId);

  return polls.filter((poll) => {
    if (poll.status === "SETTLED") return false;
    if (poll.closesOn < today) return false;
    const replies = poll.options.flatMap((option) => option.replies);
    return tallyPoll(poll.options, replies, profileIds).some((tally) =>
      tally.silentBy.includes(profileId),
    );
  });
}
