import "server-only";

import type {
  AgendaEntryDto,
  AroundDto,
  AwaitingPollDto,
  BoardDto,
  GatheringDto,
  GridRowDto,
  MeDto,
  PasskeyDto,
  PollDto,
  PollOptionDto,
  PresenceDto,
  PresenceRunDto,
  ReplyKindDto,
} from "@/lib/api/v1/dto";
import type { BoardPoll, BoardPresence, FamilyMember } from "@/lib/board/data";
import { avatarPath } from "@/lib/avatars/path";
import { tallyPoll } from "@/lib/polls/tally";
import type { StripData } from "@/lib/board/editor";
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
    avatarPath: avatarPath(row.member.profileId, row.member.name),
    state: row.state,
    until: row.until,
    note: row.note,
  };
}

function toGatheringDto(
  gathering: BoardView["gathering"],
): GatheringDto | null {
  if (!gathering) return null;
  return { date: gathering.date, inDays: gathering.inDays };
}

function toGridRowDto(row: BoardView["grid"][number]): GridRowDto {
  return {
    profileId: row.member.profileId,
    name: row.member.name,
    avatarPath: avatarPath(row.member.profileId, row.member.name),
    days: row.days,
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

    return {
      kind: "birthday",
      date: entry.date,
      profileId: entry.profileId,
      personName,
      turning: entry.turning,
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
    // Names rather than ids, for the same reason the agenda resolves its own: the sentence the
    // client renders is "Waiting on Macy and Tanner", and shipping the roster so every client can
    // perform that join is work done twice to reach one answer.
    unsaidNames: view.unsaidToday.map((member) => member.name),
    presence: view.presence.map(toPresenceDto),
    gridDays: view.gridDays,
    grid: view.grid.map(toGridRowDto),
    agenda: toAgendaDto(view.agenda, view.membersByProfileId),
    agendaWindowDays: AGENDA_WINDOW_DAYS,
  };
}

// --- Presence ----------------------------------------------------------------

/**
 * The Around screen's data.
 *
 * `strips` carries only the people the viewer may edit — `getStripData` has already narrowed that
 * from the actor's role. The client does not filter: a strip it cannot change is a strip it should
 * never have been shown, and deciding that here means one answer rather than one per client.
 */
export function toAroundDto(
  data: StripData,
  viewerProfileId: string,
): AroundDto {
  return {
    today: data.today,
    through: data.through,
    viewerProfileId,
    strips: data.strips.map((strip) => ({
      profileId: strip.member.profileId,
      name: strip.member.name,
      avatarPath: avatarPath(strip.member.profileId, strip.member.name),
      runs: strip.runs.map(toPresenceRunDto),
      horizon: strip.horizon,
    })),
  };
}

function toPresenceRunDto(run: BoardPresence): PresenceRunDto {
  return {
    id: run.id,
    profileId: run.profileId,
    state: run.state,
    startsOn: run.startsOn,
    endsOn: run.endsOn,
    note: run.note,
  };
}

// --- Polls -------------------------------------------------------------------

/**
 * An ask, tallied and resolved to names.
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

    // Silence is a missing key, not a null: the tally counts it as its own state, and a map that
    // held everyone would make "has not answered" and "answered nothing" the same shape.
    const replyByProfileId: Record<string, ReplyKindDto> = {};
    for (const id of tally.yesBy) replyByProfileId[id] = "YES";
    for (const id of tally.maybeBy) replyByProfileId[id] = "MAYBE";
    for (const id of tally.noBy) replyByProfileId[id] = "NO";

    return {
      id: tally.optionId,
      label: window?.label ?? null,
      onDate: window?.onDate ?? null,
      yesNames: names(tally.yesBy),
      maybeNames: names(tally.maybeBy),
      noNames: names(tally.noBy),
      silentNames: names(tally.silentBy),
      unanimous: tally.unanimous,
      myReply: mine?.kind ?? null,
      isSettled: poll.settledOptionId === tally.optionId,
      replyByProfileId,
    };
  });

  return {
    id: poll.id,
    title: poll.title,
    status: poll.status,
    closesOn: poll.closesOn,
    // Null when the viewer asked it — being told "Brandon is waiting on you" when you are Brandon
    // reads as a bug, so the decision is made here rather than left to each client to remember.
    askedByName: poll.createdById === viewerUserId ? null : poll.createdByName,
    awaitingYou:
      poll.status === "OPEN" &&
      tallies.some((tally) => tally.silentBy.includes(viewerProfileId)),
    options,
    // `members` is already in board order — `getFamilyMembers` sorts it — and the client draws it
    // in the order it arrives, so the avatars read down a poll the same way they read down the
    // board.
    members: members.map((member) => ({
      profileId: member.profileId,
      name: member.name,
      avatarPath: avatarPath(member.profileId, member.name),
    })),
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
