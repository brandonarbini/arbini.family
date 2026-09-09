import "server-only";

import {
  type BoardPoll,
  type FamilyMember,
  getFamilyMembers,
  getPoll,
  getPresenceForWindow,
} from "@/lib/board/data";
import {
  type CalendarDate,
  differenceInCalendarDays,
  eachCalendarDay,
} from "@/lib/dates";
import { type OptionTally, rankOptions, tallyPoll } from "@/lib/polls/tally";
import { statesOn } from "@/lib/presence/derive";

/**
 * One poll, assembled for the ballot.
 *
 * Route-private: this shape exists to be rendered by `/polls/[id]` and nowhere else. No auth here
 * — `page.tsx` does that before calling in.
 */

export interface OptionView {
  optionId: string;
  startsOn: CalendarDate;
  endsOn: CalendarDate;
  tally: OptionTally;
  /** True when this is the option the family landed on. */
  isSettled: boolean;
  /**
   * People who have already said they will be away for some part of the option, and why.
   *
   * Read, never written. Settling used to record everyone's answer as a location, which meant
   * saying yes to a Thursday quietly asserted where you would be for two days; that is gone. What
   * survives is the useful half — seeing "Addison's away — Vanguard" at the moment somebody is
   * choosing a Thursday, so nobody proposes one without knowing.
   *
   * Built from what people have said alone, so the line is empty until somebody has said
   * something. Silence here means nothing is known, not that everyone is free — the tally is what
   * says who can come, and this only flags the days an existing statement already contradicts.
   * Derived, never stored.
   */
  awayNotes: { member: FamilyMember; note: string | null }[];
}

export interface PollView {
  poll: BoardPoll;
  members: FamilyMember[];
  options: OptionView[];
  /** Best first, so whoever settles it does not have to read the counts. */
  ranked: OptionTally[];
  /** True when the viewer has answered every option. Drives the board's nudge card. */
  answeredEverything: boolean;
}

export async function getPollView(
  pollId: string,
  viewerProfileId: string,
): Promise<PollView | null> {
  const poll = await getPoll(pollId);
  if (!poll) return null;

  const members = await getFamilyMembers();
  const profileIds = members.map((member) => member.profileId);
  const replies = poll.options.flatMap((option) => option.replies);
  const tallies = tallyPoll(poll.options, replies, profileIds);
  const talliesById = new Map(tallies.map((tally) => [tally.optionId, tally]));

  // Bounded by the options themselves rather than by a fixed horizon: a poll about Thanksgiving
  // is months out, and a 30-day window would load none of the runs that cover it.
  const earliest = poll.options.reduce<CalendarDate | null>(
    (min, option) =>
      min === null || option.startsOn < min ? option.startsOn : min,
    null,
  );
  const latest = poll.options.reduce<CalendarDate | null>(
    (max, option) =>
      max === null || option.endsOn > max ? option.endsOn : max,
    null,
  );
  const rows =
    earliest && latest
      ? await getPresenceForWindow(
          earliest,
          differenceInCalendarDays(earliest, latest),
        )
      : [];

  const membersByProfileId = new Map(
    members.map((member) => [member.profileId, member]),
  );

  const options: OptionView[] = poll.options.map((option) => {
    // One entry per person, not per day: "Addison's away" reads as context, whereas the same
    // sentence repeated for each day of a long weekend reads as an error message.
    const away = new Map<string, string | null>();
    for (const day of eachCalendarDay(option.startsOn, option.endsOn)) {
      for (const [profileId, state] of statesOn(rows, profileIds, day)) {
        // Unsaid is not away. A person who has said nothing about a Thursday has not objected to
        // it, and flagging them would turn silence into an answer — which is the one thing
        // nothing in this app does.
        if (state !== "AWAY" || away.has(profileId)) continue;
        const run =
          rows.find(
            (row) =>
              row.profileId === profileId &&
              row.startsOn <= day &&
              (row.endsOn === null || row.endsOn >= day),
          ) ?? null;
        away.set(profileId, run?.note ?? null);
      }
    }

    return {
      optionId: option.optionId,
      startsOn: option.startsOn,
      endsOn: option.endsOn,
      tally: talliesById.get(option.optionId)!,
      isSettled: poll.settledOptionId === option.optionId,
      awayNotes: [...away]
        .map(([profileId, note]) => ({
          member: membersByProfileId.get(profileId)!,
          note,
        }))
        // Board order, so the notes read down the page the same way the avatars do.
        .sort((a, b) => a.member.sortOrder - b.member.sortOrder),
    };
  });

  return {
    poll,
    members,
    options,
    ranked: rankOptions(tallies),
    answeredEverything: options.every((option) =>
      option.tally.silentBy.every((id) => id !== viewerProfileId),
    ),
  };
}
