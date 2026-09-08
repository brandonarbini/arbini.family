import "server-only";

import type {
  AgendaEntryDto,
  AwaitingPollDto,
  BoardDto,
  GatheringDto,
  MeDto,
  PlaceDto,
  PresenceDto,
} from "@/lib/api/v1/dto";
import type { BoardPoll, Place } from "@/lib/board/data";
import type { AgendaEntry } from "@/lib/board/agenda";
import type { BoardView } from "@/lib/board/view";
import { AGENDA_WINDOW_DAYS } from "@/lib/board/view";
import type { ProfileActor } from "@/lib/api/guard";

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
