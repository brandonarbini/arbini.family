/**
 * The v1 wire contract: what `/api/v1/*` sends, described once, for both sides.
 *
 * **This file must have no imports.** The Expo app type-checks against it directly, through a
 * `@server/*` path alias, and its TypeScript has none of the web's dependencies — no Prisma
 * client, no zod. Types are erased at compile time, so Metro never resolves this at runtime and
 * no shared package is needed; the price of that convenience is that the file has to stand alone.
 *
 * It is also deliberately *not* the internal types re-exported. Two reasons, and the second is the
 * one that matters:
 *
 * 1. The internal shapes do not survive JSON. `BoardPoll.createdAt` is a `Date`; `Response.json()`
 *    makes it a string, so a handler returning the internal type type-checks against a lie.
 * 2. A shipped app binary cannot be re-deployed. Someone on last month's build will call this
 *    week's server, so the wire shape has to be a thing that changes deliberately rather than
 *    whatever the database happened to look like. `lib/api/v1/serialize.ts` is where the two meet,
 *    and it is the place a breaking change becomes visible instead of silent.
 *
 * Anything added here is a promise to a binary you no longer control. Add optional fields; do not
 * repurpose existing ones.
 */

/**
 * A calendar date as `YYYY-MM-DD`.
 *
 * The board is date-based, never instant-based: a stay covers days, not moments. The web brands
 * this type in `lib/dates.ts`; here it is a plain string because this file cannot import that
 * brand — the shape on the wire is identical either way.
 *
 * Always resolved in the family's timezone by the server. The client must never compute "today"
 * itself: a phone in another timezone would otherwise show a different board than the fridge.
 */
export type CalendarDateString = string;

/** Mirrors the `FamilyRole` enum in schema.prisma. */
export type FamilyRoleDto = "PARENT" | "KID";

export interface PlaceDto {
  id: string;
  name: string;
  isHome: boolean;
}

export interface MemberDto {
  profileId: string;
  name: string;
  role: FamilyRoleDto;
  /** The per-person accent from `Profile.color`, or null when unset. */
  color: string | null;
}

/** Who is signed in, and what they are allowed to do. */
export interface MeDto {
  profileId: string;
  name: string;
  email: string;
  role: FamilyRoleDto;
}

/** Where one person is today. */
export interface PresenceDto {
  profileId: string;
  name: string;
  /** Null means nothing is recorded — which is not the same as being at home. */
  place: PlaceDto | null;
  /** Last day at that place; null for an open-ended stay, or when nothing is recorded. */
  until: CalendarDateString | null;
}

/** The next day everyone is in the same place. */
export interface GatheringDto {
  date: CalendarDateString;
  place: PlaceDto;
  /** Zero when it is today. */
  inDays: number;
}

/**
 * One line of the agenda, with ids already resolved to names.
 *
 * Resolving server-side rather than shipping lookup tables: the server holds the data anyway, and
 * the alternative is every client reimplementing the same join. Dates stay as calendar dates
 * rather than formatted strings, because *formatting* is presentation and belongs to the client —
 * but *which day it is* is a fact, and that belongs to the server.
 */
export type AgendaEntryDto =
  | {
      kind: "arrival" | "departure";
      date: CalendarDateString;
      profileId: string;
      personName: string;
      placeName: string;
    }
  | {
      kind: "birthday";
      date: CalendarDateString;
      profileId: string;
      personName: string;
      turning: number;
    }
  | {
      kind: "event";
      date: CalendarDateString;
      eventId: string;
      title: string;
      note: string | null;
    };

/**
 * A poll waiting on the person who asked for the board.
 *
 * `waitingOnName` is the poll's author, or null when that is the viewer themselves — you can
 * perfectly well owe an answer to your own poll, but being told so in the third person reads as
 * a bug, so the server sends null and the client says "you haven't answered yet".
 */
export interface AwaitingPollDto {
  id: string;
  title: string;
  waitingOnName: string | null;
}

/** Everything `/home` renders, in one response. */
export interface BoardDto {
  /** The family's today, authoritative. */
  today: CalendarDateString;
  awaiting: AwaitingPollDto[];
  gathering: GatheringDto | null;
  presence: PresenceDto[];
  agenda: AgendaEntryDto[];
  /** How many days ahead `agenda` looks, so the client can label the section honestly. */
  agendaWindowDays: number;
}

// --- Errors ------------------------------------------------------------------

/**
 * Machine-readable failure codes. The client switches on these, never on the message — messages
 * are for people and may be reworded at any time.
 */
export type ApiErrorCode =
  "unauthenticated" | "forbidden" | "not_found" | "invalid_input" | "internal";

/**
 * The body of any non-2xx response.
 *
 * `fieldErrors` keeps the exact `Record<string, string[]>` shape of `ActionResult` on the web, so
 * a native form can render validation failures with the same code the web form uses. The status
 * code carries the category — unlike a Server Action, HTTP has somewhere to put it.
 */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

// --- Stays -------------------------------------------------------------------

/** One recorded stay: a person at a place, over a range of days. */
export interface StayDto {
  id: string;
  profileId: string;
  place: PlaceDto;
  startsOn: CalendarDateString;
  /** The last day *at* the place. Null means open-ended — "from then on". */
  endsOn: CalendarDateString | null;
  note: string | null;
}

/** One person's stays, as the editor lists them. */
export interface StayListDto {
  profileId: string;
  name: string;
  stays: StayDto[];
}

/**
 * Everything the "Where I am" screen needs.
 *
 * `lists` holds only the people the viewer may edit — themselves, or everyone if they are a
 * parent — because the screen exists to change things, and listing rows that would be refused is
 * an invitation to be refused. The server decides this; the client does not filter.
 */
export interface WhereDto {
  today: CalendarDateString;
  places: PlaceDto[];
  lists: StayListDto[];
}

/** The body of `POST /api/v1/stays` and `PATCH /api/v1/stays/:id`. */
export interface StayInputDto {
  profileId: string;
  placeId: string;
  startsOn: CalendarDateString;
  endsOn: CalendarDateString | null;
  note: string | null;
}

// --- Polls -------------------------------------------------------------------

export type PollStatusDto = "OPEN" | "SETTLED";

/** Mirrors the `ReplyKind` enum in schema.prisma. */
export type ReplyKindDto = "YES" | "MAYBE" | "NO";

/**
 * One date option on a poll, already tallied.
 *
 * Names rather than profile ids, for the same reason the agenda resolves its own: the server holds
 * the roster, and shipping it so every client can perform the same join is work done twice to
 * reach one answer.
 *
 * `silentNames` is who has not answered *this* option. Deliberately not folded into `no` — silence
 * is not a refusal, and a tally that treated it as one would settle dates nobody agreed to.
 */
export interface PollOptionDto {
  id: string;
  startsOn: CalendarDateString;
  endsOn: CalendarDateString;
  yesNames: string[];
  maybeNames: string[];
  noNames: string[];
  silentNames: string[];
  /** Every single person said yes — not merely that nobody said no. */
  everyoneCanMake: boolean;
  /** The viewer's own answer to this option, or null if they have not given one. */
  myReply: ReplyKindDto | null;
  /** True when the poll settled on this option. */
  isSettled: boolean;
}

export interface PollDto {
  id: string;
  title: string;
  status: PollStatusDto;
  /** Where the gathering is. Null means home, resolved when the poll settles. */
  placeName: string | null;
  /** Who asked, or null when that is the viewer themselves — see `AwaitingPollDto`. */
  askedByName: string | null;
  /** True while any option is still waiting on the viewer. */
  awaitingYou: boolean;
  options: PollOptionDto[];
}

/** The body of `PUT /api/v1/polls/:pollId/options/:optionId/reply`. */
export interface ReplyInputDto {
  /** Null clears the answer, which is not the same as answering no. */
  kind: ReplyKindDto | null;
}

// --- Passkeys ----------------------------------------------------------------

/** Whether the credential can leave the device it was made on. */
export type PasskeyDeviceTypeDto = "singleDevice" | "multiDevice";

/**
 * One passkey, already named.
 *
 * `label` rather than `name` + `aaguid`, and the difference is the point: an unnamed credential is
 * called after the authenticator it lives in ("1Password", "iCloud Keychain"), and that mapping is
 * a table that grows as new password managers ship. Resolving it on the server means a phone
 * running last month's binary still names this month's authenticators, and that the website and
 * the app can never disagree about what a row is called.
 *
 * No `createdAt`: nothing renders it, and a date on the wire is a promise about a format.
 */
export interface PasskeyDto {
  id: string;
  label: string;
  deviceType: PasskeyDeviceTypeDto;
}
