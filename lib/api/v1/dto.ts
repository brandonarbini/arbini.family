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
 * **Additive only from the first App Store release.** Until then this file has been rewritten
 * outright once — retiring places and stays for presence — because every install was an internal
 * build and the audience was a text message. That was the last cheap moment, and it is worth
 * naming rather than leaving the rule looking absolute and then quietly broken: after the first
 * public release, add optional fields and do not repurpose existing ones, because there will be
 * somebody on last month's build and no way to reach them.
 */

/**
 * A calendar date as `YYYY-MM-DD`.
 *
 * The board is date-based, never instant-based: a run covers days, not moments. The web brands
 * this type in `lib/dates.ts`; here it is a plain string because this file cannot import that
 * brand — the shape on the wire is identical either way.
 *
 * Always resolved in the family's timezone by the server. The client must never compute "today"
 * itself: a phone in another timezone would otherwise show a different board than the fridge.
 */
export type CalendarDateString = string;

/** Mirrors the `FamilyRole` enum in schema.prisma. */
export type FamilyRoleDto = "PARENT" | "KID";

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

/**
 * Whether somebody will be with the family, on a stretch of days.
 *
 * AROUND means "I'll be there" — not "at home", and not "free". The whole gathering countdown
 * rests on that reading; see the enum comment in `schema.prisma`.
 */
export type PresenceStateDto = "AROUND" | "AWAY";

/** Where one person stands today. */
export interface PresenceDto {
  profileId: string;
  name: string;
  /** Null means nothing has been said about today — which is not the same as being away. */
  state: PresenceStateDto | null;
  /** Last day the current run holds; null when it is open-ended, or when nothing is said. */
  until: CalendarDateString | null;
  /** The run's own note — "Vanguard", "work trip" — when it carries one. */
  note: string | null;
  /** Where to fetch this person's avatar — see the note at the foot of this file. */
  avatarPath?: string;
}

/** The next day everybody is around. */
export interface GatheringDto {
  date: CalendarDateString;
  /** Zero when it is today. */
  inDays: number;
}

/**
 * One person's fortnight, as cells: the board's resting state.
 *
 * `days` runs from `BoardDto.today` forward, one entry per day, and its length is
 * `BoardDto.gridDays.length` — the dates are sent alongside rather than recomputed, so a client
 * never has to do calendar arithmetic to label a column.
 *
 * Null is *unsaid*, and is drawn as a gap rather than as a third state. It is the absence of a
 * statement, not a statement of absence.
 */
export interface GridRowDto {
  profileId: string;
  name: string;
  /** Where to fetch this person's avatar — see the note at the foot of this file. */
  avatarPath?: string;
  days: (PresenceStateDto | null)[];
}

/**
 * One line of the agenda, with ids already resolved to names.
 *
 * Birthdays and one-off dates, and nothing else. Arrivals and departures used to be here too, and
 * that is what made the section unreadable: a weekend everyone is home produced five near-identical
 * lines saying what `grid` already shows at a glance. What is left is the part the grid cannot
 * show.
 *
 * Resolving server-side rather than shipping lookup tables: the server holds the data anyway, and
 * the alternative is every client reimplementing the same join. Dates stay as calendar dates
 * rather than formatted strings, because *formatting* is presentation and belongs to the client —
 * but *which day it is* is a fact, and that belongs to the server.
 */
export type AgendaEntryDto =
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
  /**
   * Who the countdown is waiting on: everyone who has said nothing about today.
   *
   * `gathering` is null whenever this is non-empty, and that is the point of sending both. The
   * countdown declines while anybody is unsaid — silence is never a yes — but declining without
   * saying why is how the board ended up with a headline that never said anything.
   */
  unsaidNames: string[];
  presence: PresenceDto[];
  /** The dates `GridRowDto.days` is indexed by, in order, starting at `today`. */
  gridDays: CalendarDateString[];
  grid: GridRowDto[];
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

// --- Presence ----------------------------------------------------------------

/** One recorded run: a stretch of days, and whether the person will be with the family. */
export interface PresenceRunDto {
  id: string;
  profileId: string;
  state: PresenceStateDto;
  startsOn: CalendarDateString;
  /** The last day the run holds. Null means open-ended — "until I say otherwise". */
  endsOn: CalendarDateString | null;
  note: string | null;
}

/**
 * How far ahead somebody has said anything, counting from today.
 *
 * Three cases rather than a date that is sometimes missing, because "said nothing" and "said,
 * with no end date" are opposite facts and a nullable date cannot tell them apart. `open` is the
 * most complete answer there is; `unsaid` is the absence of one.
 */
export type HorizonDto =
  | { kind: "unsaid" }
  | { kind: "through"; date: CalendarDateString }
  | { kind: "open" };

/** One person's strip: what they have said, and how far ahead they have said it. */
export interface StripDto {
  profileId: string;
  name: string;
  /** Where to fetch this person's avatar — see the note at the foot of this file. */
  avatarPath?: string;
  runs: PresenceRunDto[];
  horizon: HorizonDto;
}

/**
 * Everything the "Around" screen needs.
 *
 * `strips` holds only the people the viewer may edit — themselves, or everyone if they are a
 * parent — because the screen exists to change things, and offering a strip that would be refused
 * is an invitation to be refused. The server decides this; the client does not filter.
 */
export interface AroundDto {
  today: CalendarDateString;
  /** The last day the strip draws. A strip's horizon is worth reading against this. */
  through: CalendarDateString;
  /**
   * Which of the strips belongs to whoever asked.
   *
   * Sent because the copy changes: your own strip says "I'll be there" and everybody else's says
   * "Macy will". A parent filling in for a kid in the first person is the kind of small wrongness
   * that makes somebody wonder whose calendar they are actually editing.
   */
  viewerProfileId: string;
  strips: StripDto[];
}

/**
 * The body of `PUT /api/v1/presence`.
 *
 * `days` is a list rather than a first-and-last pair. The strip is a fortnight of individually
 * tappable cells, so a selection is often not contiguous — "Friday, Saturday and the Tuesday
 * after" is one act. The server collapses them into runs when it writes, so the storage stays a
 * range and a weekend is still one row.
 *
 * `state: null` clears the days, returning them to unsaid rather than recording an away — the same
 * shape as `ReplyInputDto`, where null clears an answer rather than recording a no.
 *
 * Open-ended presence ("at school until I say otherwise") has no representation here, and cannot:
 * a list of days always has a last one. The model holds it and nothing yet writes one.
 */
export interface PresenceInputDto {
  profileId: string;
  state: PresenceStateDto | null;
  days: CalendarDateString[];
  note: string | null;
}

// --- Polls -------------------------------------------------------------------

export type PollStatusDto = "OPEN" | "SETTLED";

/** Mirrors the `ReplyKind` enum in schema.prisma. */
export type ReplyKindDto = "YES" | "MAYBE" | "NO";

/**
 * One person on the poll, for a client that needs to draw them.
 *
 * Ids as well as names, unlike the tally arrays below. Those answer "who said yes", which a name
 * answers perfectly well; this answers "who is on this poll", and an avatar is fetched per
 * `profileId` — see `/api/v1/avatars`.
 */
export interface PollMemberDto {
  profileId: string;
  name: string;
  /** Where to fetch this person's avatar — see the note at the foot of this file. */
  avatarPath?: string;
}

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
  /**
   * Each person's answer to this option, by profile id. Absent from the map means silent — the
   * same third state the name arrays keep apart, expressed as a missing key rather than a null.
   *
   * Optional because a binary built before this existed will not find it. Draw nothing in that
   * case; the tally arrays above still say everything they always said.
   */
  replyByProfileId?: Record<string, ReplyKindDto>;
}

export interface PollDto {
  id: string;
  title: string;
  status: PollStatusDto;
  /** Who asked, or null when that is the viewer themselves — see `AwaitingPollDto`. */
  askedByName: string | null;
  /** True while any option is still waiting on the viewer. */
  awaitingYou: boolean;
  options: PollOptionDto[];
  /**
   * Everyone the poll is asking, in board order. One roster for the whole poll rather than one per
   * option, because it is the same five people every time.
   */
  members?: PollMemberDto[];
}

/**
 * ## `avatarPath`
 *
 * A path onto `/api/v1/avatars/{profileId}`, carrying a `v` parameter that is the content hash of
 * the avatar itself.
 *
 * Sent by the server rather than assembled by the client, and the version is the whole reason.
 * A native image cache keys on the URL and does not necessarily re-ask the server, so a URL that
 * never changes is a face that never changes — and the point of serving avatars from an endpoint
 * is that restyling them, or replacing one with a photograph, reaches a phone that has already
 * shipped. It only does if the URL moves when the picture does.
 *
 * Optional, so a binary built before this existed still finds the shape it expects. Such a client
 * builds the unversioned URL itself and gets a one-hour cache and an ETag, which is what it always
 * had.
 */

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
