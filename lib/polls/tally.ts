import type { ReplyKind } from "@/generated/prisma/enums";
import type { CalendarDate } from "@/lib/dates";

/**
 * Counting a poll.
 *
 * Plain objects in, plain objects out — no Prisma, no database, so the rule that decides which
 * date the family lands on can be tested directly rather than through a route.
 *
 * Everything here is sorted to a *total* order. Five people answering at once means the ballot
 * re-fetches constantly, and a list that reorders under a thumb is unusable — the same argument
 * `upcomingTransitions` makes in `lib/presence.ts` for sorting same-day events past their date.
 */

export interface PollOptionWindow {
  optionId: string;
  startsOn: CalendarDate;
  /** Last day of the option, inclusive — matching `Stay`. A single day has matching dates. */
  endsOn: CalendarDate;
  sortOrder: number;
}

export interface PollReplyRecord {
  optionId: string;
  profileId: string;
  kind: ReplyKind;
}

export interface OptionTally {
  optionId: string;
  yes: number;
  maybe: number;
  no: number;
  /** Profile ids, each sorted so a re-fetch cannot reshuffle the avatars. */
  yesBy: string[];
  maybeBy: string[];
  noBy: string[];
  /** Everyone who has not answered *this* option. Never counted as a no. */
  silentBy: string[];
  /**
   * Every single person said yes.
   *
   * Deliberately not "nobody said no": silence is not consent, and a poll that declared a date
   * settled because three people ignored it would be wrong in the way that matters most.
   */
  everyoneCanMake: boolean;
}

/**
 * Count each option, in the order the poll presents them.
 *
 * Replies for people outside `profileIds` are ignored rather than counted — a profile removed
 * from the family should not keep voting, and its stale rows should not make a tally exceed the
 * number of people in it.
 */
export function tallyPoll(
  options: readonly PollOptionWindow[],
  replies: readonly PollReplyRecord[],
  profileIds: readonly string[],
): OptionTally[] {
  const members = new Set(profileIds);

  return sortOptions(options).map((option) => {
    const answered = new Map<string, ReplyKind>();
    for (const reply of replies) {
      if (reply.optionId !== option.optionId) continue;
      if (!members.has(reply.profileId)) continue;
      answered.set(reply.profileId, reply.kind);
    }

    // Built by walking `profileIds` rather than the replies, so each list comes out in a stable
    // order without a sort, and a person appears in exactly one of the four.
    const yesBy: string[] = [];
    const maybeBy: string[] = [];
    const noBy: string[] = [];
    const silentBy: string[] = [];
    for (const profileId of profileIds) {
      const kind = answered.get(profileId);
      if (kind === "YES") yesBy.push(profileId);
      else if (kind === "MAYBE") maybeBy.push(profileId);
      else if (kind === "NO") noBy.push(profileId);
      else silentBy.push(profileId);
    }

    return {
      optionId: option.optionId,
      yes: yesBy.length,
      maybe: maybeBy.length,
      no: noBy.length,
      yesBy,
      maybeBy,
      noBy,
      silentBy,
      everyoneCanMake:
        profileIds.length > 0 && yesBy.length === profileIds.length,
    };
  });
}

/**
 * Best option first, so the person settling the poll does not have to read the counts.
 *
 * A "maybe" breaks a tie between equal yes counts but never outranks a yes, because the question
 * being answered is who can definitely come. `sortOrder` is the final tiebreak rather than the
 * option id: two equally good dates should appear in the order the poll asked about them, which
 * is chronological, and that reads as an answer rather than as an accident.
 */
export function rankOptions(tallies: readonly OptionTally[]): OptionTally[] {
  const bySortOrder = new Map(
    tallies.map((tally, index) => [tally.optionId, index]),
  );
  return [...tallies].sort(
    (a, b) =>
      Number(b.everyoneCanMake) - Number(a.everyoneCanMake) ||
      b.yes - a.yes ||
      b.maybe - a.maybe ||
      a.no - b.no ||
      bySortOrder.get(a.optionId)! - bySortOrder.get(b.optionId)!,
  );
}

/**
 * Options in presentation order: chronological, with `sortOrder` deciding and the id breaking an
 * exact tie so the sort is total rather than merely mostly-ordered.
 */
export function sortOptions(
  options: readonly PollOptionWindow[],
): PollOptionWindow[] {
  return [...options].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.startsOn.localeCompare(b.startsOn) ||
      a.optionId.localeCompare(b.optionId),
  );
}
