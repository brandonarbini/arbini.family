import "server-only";

import { type AgendaEntry, buildAgenda } from "@/lib/board/agenda";
import { upcomingBirthdays } from "@/lib/board/birthdays";
import {
  type BoardPoll,
  GATHERING_HORIZON_DAYS,
  type FamilyMember,
  type Place,
  getEventsForWindow,
  getFamilyMembers,
  getPlaces,
  getPolls,
  getStaysForWindow,
} from "@/lib/board/data";
import { type CalendarDate, differenceInCalendarDays } from "@/lib/dates";
import { tallyPoll } from "@/lib/polls/tally";
import {
  findNextGathering,
  staysOn,
  upcomingTransitions,
} from "@/lib/presence";

/**
 * The board, assembled.
 *
 * Route-private because this shape exists to be rendered by `/home` and nowhere else; the reads
 * it composes are the shared ones in `@/lib/board/data`.
 *
 * No auth here — `page.tsx` does that before calling in.
 *
 * `today` is a required parameter rather than a default read from the clock. The reads underneath
 * are cached and keyed on their arguments, so a date resolved in here would be baked into the
 * cache entry and the board would still be showing yesterday tomorrow. The page reads the clock,
 * which it may — it is dynamic already because it reads the session.
 */

/** How far ahead "what's coming up" looks. A month is about as far as a family plans in detail. */
export const AGENDA_WINDOW_DAYS = 30;

export interface MemberPresence {
  member: FamilyMember;
  /** Where a stay puts them today, or `null` when nothing is recorded. */
  place: Place | null;
  /** Last day at that place; `null` for an open-ended stay or when nothing is recorded. */
  until: CalendarDate | null;
}

export interface NextGathering {
  date: CalendarDate;
  place: Place;
  /** Zero when it is today. */
  inDays: number;
}

export async function getBoardView(today: CalendarDate) {
  // Started together rather than awaited in sequence: they are independent, and four sequential
  // round trips would make the board's first paint the sum of them rather than the slowest.
  const [members, places, stays, events] = await Promise.all([
    getFamilyMembers(),
    getPlaces(),
    getStaysForWindow(today, GATHERING_HORIZON_DAYS),
    getEventsForWindow(today, AGENDA_WINDOW_DAYS),
  ]);

  const placesById = new Map(places.map((place) => [place.id, place]));
  const profileIds = members.map((member) => member.profileId);

  // `staysOn` rather than `locationsOn`: the row reports not just where somebody is but until
  // when, and that needs the whole stay.
  const covering = staysOn(stays, profileIds, today);
  const presence: MemberPresence[] = members.map((member) => {
    const stay = covering.get(member.profileId) ?? null;
    return {
      member,
      place: stay ? (placesById.get(stay.placeId) ?? null) : null,
      until: stay?.endsOn ?? null,
    };
  });

  const found = findNextGathering(
    stays,
    profileIds,
    today,
    GATHERING_HORIZON_DAYS,
  );
  const gatheringPlace = found ? placesById.get(found.placeId) : undefined;
  const gathering: NextGathering | null =
    found && gatheringPlace
      ? {
          date: found.date,
          place: gatheringPlace,
          inDays: differenceInCalendarDays(today, found.date),
        }
      : null;

  const agenda: AgendaEntry[] = buildAgenda({
    transitions: upcomingTransitions(stays, today, AGENDA_WINDOW_DAYS),
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
    agenda,
    // Lookups the agenda needs to render a name where it holds an id. Plain objects rather than
    // Maps so this shape stays trivially serializable if a client component ever needs it.
    membersByProfileId: Object.fromEntries(
      members.map((member) => [member.profileId, member]),
    ) as Record<string, FamilyMember>,
    placesById: Object.fromEntries(
      places.map((place) => [place.id, place]),
    ) as Record<string, Place>,
  };
}

export type BoardView = Awaited<ReturnType<typeof getBoardView>>;

/**
 * Live polls this person has not finished answering.
 *
 * Read separately from `getBoardView` rather than folded into it, because it is the one thing on
 * the board that depends on *who is looking*. Threading a viewer through the board view would
 * make every one of its cached reads per-person for the sake of a single line.
 *
 * "Live" is derived from the option dates, so a poll nobody ever settled stops nagging once its
 * days have passed instead of sitting on the board forever.
 */
export async function getPollsAwaiting(
  profileId: string,
  today: CalendarDate,
): Promise<BoardPoll[]> {
  const [polls, members] = await Promise.all([getPolls(), getFamilyMembers()]);
  const profileIds = members.map((member) => member.profileId);

  return polls.filter((poll) => {
    if (poll.status === "SETTLED") return false;
    if (!poll.options.some((option) => option.endsOn >= today)) return false;
    const replies = poll.options.flatMap((option) => option.replies);
    return tallyPoll(poll.options, replies, profileIds).some((tally) =>
      tally.silentBy.includes(profileId),
    );
  });
}
