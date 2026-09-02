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
import { type CalendarDate, eachCalendarDay } from "@/lib/dates";
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
   * People who are somewhere other than home for any part of the option, and where.
   *
   * The whole reason `Profile.defaultPlaceId` exists shows up here: four of the five are home by
   * default and their line is empty, but Addison is on campus, and nobody should propose a
   * Thursday without seeing that. Derived, never stored.
   */
  awayNotes: { member: FamilyMember; place: Place }[];
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

  const [members, places] = await Promise.all([
    getFamilyMembers(),
    getPlaces(),
  ]);
  const profileIds = members.map((member) => member.profileId);
  const replies = poll.options.flatMap((option) => option.replies);
  const tallies = tallyPoll(poll.options, replies, profileIds);
  const talliesById = new Map(tallies.map((tally) => [tally.optionId, tally]));

  // Bounded by the options themselves rather than by a fixed horizon: a poll about Thanksgiving
  // is months out, and a 30-day window would report everyone as home by default.
  const earliest = poll.options.reduce<CalendarDate | null>(
    (min, option) =>
      min === null || option.startsOn < min ? option.startsOn : min,
    null,
  );
  const stays = earliest ? await getStaysForWindow(earliest, 365) : [];

  const placesById = new Map(places.map((place) => [place.id, place]));
  const membersByProfileId = new Map(
    members.map((member) => [member.profileId, member]),
  );
  const defaults = new Map(
    members.map((member) => [member.profileId, member.defaultPlaceId]),
  );

  const options: OptionView[] = poll.options.map((option) => {
    // One entry per person, not per day: "Addison's at Vanguard" reads as context, whereas the
    // same sentence repeated for each day of a long weekend reads as an error message.
    const away = new Map<string, Place>();
    for (const day of eachCalendarDay(option.startsOn, option.endsOn)) {
      for (const [profileId, placeId] of locationsOn(
        stays,
        profileIds,
        day,
        defaults,
      )) {
        if (placeId === null || away.has(profileId)) continue;
        const place = placesById.get(placeId);
        if (place && !place.isHome) away.set(profileId, place);
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
    members,
    options,
    ranked: rankOptions(tallies),
    answeredEverything: options.every((option) =>
      option.tally.silentBy.every((id) => id !== viewerProfileId),
    ),
  };
}
