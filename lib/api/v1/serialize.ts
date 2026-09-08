import "server-only";

import type {
  AgendaEntryDto,
  AwaitingPollDto,
  BoardDto,
  CalendarDateString,
  GatheringDto,
  MeDto,
  PasskeyDto,
  PlaceDto,
  PollDto,
  PollOptionDto,
  PresenceDto,
  StayDto,
  WhereDto,
} from "@/lib/api/v1/dto";
import type {
  BoardPoll,
  BoardStay,
  FamilyMember,
  Place,
} from "@/lib/board/data";
import { tallyPoll } from "@/lib/polls/tally";
import type { EditorData } from "@/lib/board/editor";
import type { AgendaEntry } from "@/lib/board/agenda";
import type { BoardView } from "@/lib/board/view";
import { AGENDA_WINDOW_DAYS } from "@/lib/board/view";
import type { ProfileActor } from "@/lib/api/guard";
import type { PasskeySummary } from "@/lib/passkeys/data";

/**
 * Where internal shapes become the wire contract.
 *
 * The whole point of this module is that it is a *place*. Returning the internal types directly
 * would work today and break silently later: a shipped app binary cannot be re-deployed, so an
 * innocuous rename in `lib/board/data.ts` would reach phones that have no idea it happened. Here
 * the compiler makes that a conversation — the mapping stops compiling and somebody decides what
 * the wire should do about it.
 *
 * It also converts what JSON cannot carry. `BoardPoll.createdAt` is a `Date`, and `Response.json()`
 * would quietly turn it into a string while the type still claimed otherwise.
 */

function toPlaceDto(place: Place): PlaceDto {
  // Deliberately not the whole row: `address` is on the board's Place and nothing on the phone
  // shows it. Sending it anyway would make it a promise.
  return { id: place.id, name: place.name, isHome: place.isHome };
}

export function toMeDto(actor: ProfileActor): MeDto {
  return {
    profileId: actor.profileId,
    name: actor.name,
    email: actor.email,
    role: actor.role,
  };
}

function toPresenceDto(row: BoardView["presence"][number]): PresenceDto {
  return {
    profileId: row.member.profileId,
    name: row.member.name,
    place: row.place ? toPlaceDto(row.place) : null,
    until: row.until,
  };
}

function toGatheringDto(
  gathering: BoardView["gathering"],
): GatheringDto | null {
  if (!gathering) return null;
  return {
    date: gathering.date,
    place: toPlaceDto(gathering.place),
    inDays: gathering.inDays,
  };
}

/**
 * Agenda entries with their ids resolved to names.
 *
 * The web resolves these at render time from the lookup tables the view carries. Doing it here
 * instead means the phone is not shipped a copy of the roster to perform the same join, and it
 * keeps the two clients from drifting on what "Someone" means when a profile is missing.
 */
function toAgendaDto(
  entries: AgendaEntry[],
  membersByProfileId: BoardView["membersByProfileId"],
  placesById: BoardView["placesById"],
): AgendaEntryDto[] {
  return entries.map((entry) => {
    if (entry.kind === "event") {
      return {
        kind: "event",
        date: entry.date,
        eventId: entry.eventId,
        title: entry.title,
        note: entry.note,
      };
    }

    // Matches the web's fallback exactly. A missing profile means a row was deleted between the
    // read and the render; naming it "Someone" is friendlier than an empty line and honest about
    // not knowing.
    const personName = membersByProfileId[entry.profileId]?.name ?? "Someone";

    if (entry.kind === "birthday") {
      return {
        kind: "birthday",
        date: entry.date,
        profileId: entry.profileId,
        personName,
        turning: entry.turning,
      };
    }

    return {
      kind: entry.kind,
      date: entry.date,
      profileId: entry.profileId,
      personName,
      placeName: placesById[entry.placeId]?.name ?? "somewhere",
    };
  });
}

/**
 * Polls awaiting the viewer.
 *
 * `waitingOnName` is null when the poll's author is the viewer. You can perfectly well owe an
 * answer to your own poll — everyone has to answer — but being told "Brandon is waiting on you"
 * when you are Brandon reads as a bug, so the decision is made here, where the viewer is known,
 * rather than left to each client to remember.
 */
function toAwaitingDto(
  polls: BoardPoll[],
  viewerUserId: string,
): AwaitingPollDto[] {
  return polls.map((poll) => ({
    id: poll.id,
    title: poll.title,
    waitingOnName:
      poll.createdById === viewerUserId ? null : poll.createdByName,
  }));
}

export function toBoardDto(
  view: BoardView,
  awaiting: BoardPoll[],
  viewerUserId: string,
): BoardDto {
  return {
    today: view.today,
    awaiting: toAwaitingDto(awaiting, viewerUserId),
    gathering: toGatheringDto(view.gathering),
    presence: view.presence.map(toPresenceDto),
    agenda: toAgendaDto(view.agenda, view.membersByProfileId, view.placesById),
    agendaWindowDays: AGENDA_WINDOW_DAYS,
  };
}

// --- Stays -------------------------------------------------------------------

/**
 * The stay editor's data.
 *
 * `lists` carries only the people the viewer may edit — `getEditorData` has already narrowed that
 * from the actor's role. The client does not filter: a row it cannot change is a row it should
 * never have been shown, and deciding that here means one answer rather than one per client.
 */
export function toWhereDto(
  today: CalendarDateString,
  data: EditorData,
): WhereDto {
  const placesById = new Map(data.places.map((place) => [place.id, place]));

  return {
    today,
    places: data.places.map(toPlaceDto),
    lists: data.stayLists.map((list) => ({
      profileId: list.member.profileId,
      name: list.member.name,
      stays: list.stays.flatMap((stay) => {
        const place = placesById.get(stay.placeId);
        // A stay whose place has been deleted cannot be rendered or safely edited, and sending it
        // with a null place would push that decision onto every client.
        return place ? [toStayDto(stay, place)] : [];
      }),
    })),
  };
}

function toStayDto(stay: BoardStay, place: Place): StayDto {
  return {
    id: stay.id,
    profileId: stay.profileId,
    place: toPlaceDto(place),
    startsOn: stay.startsOn,
    endsOn: stay.endsOn,
    note: stay.note,
  };
}

// --- Polls -------------------------------------------------------------------

/**
 * A poll, tallied and resolved to names.
 *
 * `viewerProfileId` decides two things the client should not have to work out: which answer is
 * "mine" on each option, and whether anything is still waiting on this person.
 */
export function toPollDto(
  poll: BoardPoll,
  members: FamilyMember[],
  viewerProfileId: string,
  viewerUserId: string,
): PollDto {
  const nameByProfileId = new Map(
    members.map((member) => [member.profileId, member.name]),
  );
  const profileIds = members.map((member) => member.profileId);
  const replies = poll.options.flatMap((option) => option.replies);
  const tallies = tallyPoll(poll.options, replies, profileIds);

  const names = (ids: string[]) =>
    ids.map((id) => nameByProfileId.get(id) ?? "Someone");

  const options: PollOptionDto[] = tallies.map((tally) => {
    const window = poll.options.find(
      (option) => option.optionId === tally.optionId,
    );
    const mine = window?.replies.find(
      (reply) => reply.profileId === viewerProfileId,
    );

    return {
      id: tally.optionId,
      startsOn: window?.startsOn ?? "",
      endsOn: window?.endsOn ?? "",
      yesNames: names(tally.yesBy),
      maybeNames: names(tally.maybeBy),
      noNames: names(tally.noBy),
      silentNames: names(tally.silentBy),
      everyoneCanMake: tally.everyoneCanMake,
      myReply: mine?.kind ?? null,
      isSettled: poll.settledOptionId === tally.optionId,
    };
  });

  return {
    id: poll.id,
    title: poll.title,
    status: poll.status,
    placeName: poll.placeName,
    // Null when the viewer asked it — being told "Brandon is waiting on you" when you are Brandon
    // reads as a bug, so the decision is made here rather than left to each client to remember.
    askedByName: poll.createdById === viewerUserId ? null : poll.createdByName,
    awaitingYou:
      poll.status === "OPEN" &&
      tallies.some((tally) => tally.silentBy.includes(viewerProfileId)),
    options,
  };
}

/**
 * A passkey on the wire.
 *
 * Field-for-field identical to `PasskeySummary` today, and still worth writing down: the internal
 * shape is free to gain `createdAt` or the raw `aaguid` the moment the website wants one, and this
 * is where somebody has to decide whether the phone gets it too.
 */
export function toPasskeyDto(passkey: PasskeySummary): PasskeyDto {
  return {
    id: passkey.id,
    label: passkey.label,
    deviceType: passkey.deviceType,
  };
}
