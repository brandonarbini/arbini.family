import type { ReplyKind } from "@/generated/prisma/enums";

/**
 * Counting an ask.
 *
 * Plain objects in, plain objects out — no Prisma, no database, so the rule that decides what the
 * family lands on can be tested directly rather than through a route.
 *
 * Everything here is sorted to a *total* order. Five people answering at once means the ballot
 * re-fetches constantly, and a list that reorders under a thumb is unusable.
 *
 * Nothing in this file knows what an option *says*. It used to take the option's dates and sort by
 * them; now it takes an id and a position, which is all counting ever needed — and it means the
 * tally did not have to learn anything when options stopped being dates.
 */

export interface PollOptionRef {
  optionId: string;
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
   * Deliberately not "nobody said no": silence is not consent, and an ask that declared itself
   * settled because three people ignored it would be wrong in the way that matters most.
   *
   * Named for what it counts rather than for what it used to mean. It was `everyoneCanMake`, which
   * was true of a date and nonsense of a dinner.
   */
  unanimous: boolean;
}

/**
 * Count each option, in the order the poll presents them.
 *
 * Replies for people outside `profileIds` are ignored rather than counted — a profile removed
 * from the family should not keep voting, and its stale rows should not make a tally exceed the
 * number of people in it.
 */
export function tallyPoll(
  options: readonly PollOptionRef[],
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
      unanimous: profileIds.length > 0 && yesBy.length === profileIds.length,
    };
  });
}

/**
 * Best option first, so the person settling the ask does not have to read the counts.
 *
 * A "maybe" breaks a tie between equal yes counts but never outranks a yes, because the question
 * being answered is who is definitely in. `sortOrder` is the final tiebreak rather than the option
 * id: two equally good options should appear in the order the ask offered them, which reads as an
 * answer rather than as an accident.
 */
export function rankOptions(tallies: readonly OptionTally[]): OptionTally[] {
  const bySortOrder = new Map(
    tallies.map((tally, index) => [tally.optionId, index]),
  );
  return [...tallies].sort(
    (a, b) =>
      Number(b.unanimous) - Number(a.unanimous) ||
      b.yes - a.yes ||
      b.maybe - a.maybe ||
      a.no - b.no ||
      bySortOrder.get(a.optionId)! - bySortOrder.get(b.optionId)!,
  );
}

/**
 * Options in the order the ask offers them, with the id breaking an exact tie so the sort is total
 * rather than merely mostly-ordered.
 *
 * `sortOrder` is assigned at creation from the order they were typed, which for a dinner is the
 * order somebody thought of them and for a set of days is chronological — the day strip hands them
 * over sorted. One rule covers both, which is why there is no longer a date to fall back to.
 */
export function sortOptions<T extends PollOptionRef>(
  options: readonly T[],
): T[] {
  return [...options].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.optionId.localeCompare(b.optionId),
  );
}
