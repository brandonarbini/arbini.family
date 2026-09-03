import "server-only";

import {
  type BoardPoll,
  type FamilyMember,
  type Place,
  getFamilyMembers,
  getPlaces,
  getPoll,
  getStaysForWindow,
} from "@/lib/board/data";
import {
  type CalendarDate,
  differenceInCalendarDays,
  eachCalendarDay,
} from "@/lib/dates";
import { type OptionTally, rankOptions, tallyPoll } from "@/lib/polls/tally";
import { locationsOn } from "@/lib/presence";

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
   * People who are somewhere other than *the gathering* for any part of the option, and where.
   *
   * Measured against the poll's own place, not against home. A "Beach day?" poll that reported
   * everyone as present because they were all at home would be exactly backwards.
   *
   * Built from recorded stays alone, so the line is empty until somebody has said where they will
   * be. Silence here means nothing is known, not that everyone is free — the tally is what says
   * who can come, and this only flags the days a recorded stay already contradicts. Derived,
   * never stored.
   */
  awayNotes: { member: FamilyMember; place: Place }[];
}

export interface PollView {
  poll: BoardPoll;
  /** Where the gathering resolves to — the poll's place, or home when it named none. */
  gatheringPlace: Place | null;
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

  const [members, places] = await Promise.all([
    getFamilyMembers(),
    getPlaces(),
  ]);
  const profileIds = members.map((member) => member.profileId);
  const replies = poll.options.flatMap((option) => option.replies);
  const tallies = tallyPoll(poll.options, replies, profileIds);
  const talliesById = new Map(tallies.map((tally) => [tally.optionId, tally]));

  // Bounded by the options themselves rather than by a fixed horizon: a poll about Thanksgiving
  // is months out, and a 30-day window would load none of the stays that cover it.
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
  const stays =
    earliest && latest
      ? await getStaysForWindow(
          earliest,
          differenceInCalendarDays(earliest, latest),
        )
      : [];

  const placesById = new Map(places.map((place) => [place.id, place]));
  // The same fallback `settlePoll` applies, so what the ballot says about who is away and what
  // settling actually writes cannot disagree.
  const gatheringPlace =
    (poll.placeId ? placesById.get(poll.placeId) : undefined) ??
    places.find((place) => place.isHome) ??
    null;
  const membersByProfileId = new Map(
    members.map((member) => [member.profileId, member]),
  );

  const options: OptionView[] = poll.options.map((option) => {
    // One entry per person, not per day: "Addison's at Vanguard" reads as context, whereas the
    // same sentence repeated for each day of a long weekend reads as an error message.
    const away = new Map<string, Place>();
    for (const day of eachCalendarDay(option.startsOn, option.endsOn)) {
      for (const [profileId, placeId] of locationsOn(stays, profileIds, day)) {
        if (placeId === null || away.has(profileId)) continue;
        if (gatheringPlace && placeId === gatheringPlace.id) continue;
        const place = placesById.get(placeId);
        if (place) away.set(profileId, place);
      }
    }

    return {
      optionId: option.optionId,
      startsOn: option.startsOn,
      endsOn: option.endsOn,
      tally: talliesById.get(option.optionId)!,
      isSettled: poll.settledOptionId === option.optionId,
      awayNotes: [...away]
        .map(([profileId, place]) => ({
          member: membersByProfileId.get(profileId)!,
          place,
        }))
        // Board order, so the notes read down the page the same way the avatars do.
        .sort((a, b) => a.member.sortOrder - b.member.sortOrder),
    };
  });

  return {
    poll,
    gatheringPlace,
    members,
    options,
    ranked: rankOptions(tallies),
    answeredEverything: options.every((option) =>
      option.tally.silentBy.every((id) => id !== viewerProfileId),
    ),
  };
}
