import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { FamilyRole, PollStatus } from "@/generated/prisma/enums";
import { BOARD_TAGS } from "@/lib/board/cache";
import {
  type CalendarDate,
  addCalendarDays,
  calendarDateFromDbDate,
  dbDateFromCalendarDate,
} from "@/lib/dates";
import type { PollOptionWindow, PollReplyRecord } from "@/lib/polls/tally";
import type { PresenceWindow } from "@/lib/presence/derive";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Shared reads for the family board.
 *
 * Lives in `/lib` rather than beside a route because both `/home` and `/home/around` need the same
 * rows, and a webhook or script would too.
 *
 * This module is also the *boundary*: `@db.Date` columns are converted to `CalendarDate` strings
 * here and nowhere else, so nothing downstream ever holds a `Date` it might format in the wrong
 * zone. Everything below returns plain data that `lib/presence/derive.ts` and
 * `lib/board/birthdays.ts` can be tested against without a database.
 *
 * No `auth()` here by design — entry points authorize, queries read. There is exactly one family,
 * so there is no tenant key to scope by. That purity is what lets these carry `"use cache"` at
 * all: a cached function that touches `cookies()` or `headers()` fails immediately with
 * `next-request-in-use-cache`.
 *
 * Arguments become the cache key automatically, which is why `from` is a parameter rather than
 * being read from the clock in here — a cached function that called `todayInFamilyTz()` itself
 * would serve yesterday's board tomorrow.
 *
 * **Cache lifetimes are set by who writes the data, not by how often it changes.** A tag only
 * fires when the write goes through a Server Action, so anything editable from outside the app —
 * profiles, which come from `prisma/seed.ts`, and events, which have no editor yet — gets
 * `"minutes"`. Members change about never and the instinct is to cache them for days, but that is
 * precisely the trap: setting the family's birthdays means editing the seed and re-running it, and
 * a day-long entry would leave the board insisting nobody has a birthday coming while the database
 * plainly says otherwise. Presence is written only through a tagged action, so by that rule it
 * could afford a longer life — see `getPresenceForWindow` for why it does not take one.
 *
 * These are five-row queries against a local Postgres; the caching here buys correctness of the
 * pattern, not latency, and it is not worth a minute of anyone's confusion.
 */

/** How far ahead `findNextGathering` may look, and therefore how many rows are worth loading. */
export const GATHERING_HORIZON_DAYS = 365;

export interface FamilyMember {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: FamilyRole;
  color: string | null;
  birthday: CalendarDate | null;
  sortOrder: number;
}

/**
 * Everyone on the board, in display order.
 *
 * Ordered by `sortOrder` then `name` so the columns never reshuffle between renders — an
 * unordered query is free to return rows differently each time, and a board whose people move
 * around is hard to read at a glance.
 */
export async function getFamilyMembers(): Promise<FamilyMember[]> {
  "use cache";
  cacheTag(BOARD_TAGS.members);
  // Minutes, not days, despite this changing about never — see the note on cache lifetimes at
  // the top of this file.
  cacheLife("minutes");

  const profiles = await prisma.profile.findMany({
    orderBy: [{ sortOrder: "asc" }, { user: { name: "asc" } }],
    select: {
      id: true,
      role: true,
      color: true,
      birthday: true,
      sortOrder: true,
      // Only what the board renders. The user row carries auth-adjacent columns that have no
      // business crossing into a client component.
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return profiles.map((profile) => ({
    profileId: profile.id,
    userId: profile.user.id,
    name: profile.user.name,
    email: profile.user.email,
    image: profile.user.image,
    role: profile.role,
    color: profile.color,
    birthday: profile.birthday
      ? calendarDateFromDbDate(profile.birthday)
      : null,
    sortOrder: profile.sortOrder,
  }));
}

export interface BoardPresence extends PresenceWindow {
  id: string;
}

/**
 * Rows that could matter to a board rendered on `from`.
 *
 * Bounded on both sides. Without the lower bound every day the family has ever recorded gets
 * loaded to answer a question about this month; without the upper bound a trip booked years out
 * is loaded to be ignored. The window matches what `findNextGathering` can actually see, so
 * narrowing it further would change answers rather than just save bytes.
 *
 * An open-ended run (`endsOn: null`) is always a candidate — it has no end to fall before the
 * window.
 *
 * `cacheLife("seconds")`, not the `"hours"` the old stays got. Painting the strip is now the main
 * thing anybody does in this app, and the board is where they look to see it worked. A minute of
 * staleness there is not a slightly old board, it is the mechanic failing — the same argument
 * `getPolls` makes below, for the same reason.
 */
export async function getPresenceForWindow(
  from: CalendarDate,
  horizonDays: number = GATHERING_HORIZON_DAYS,
): Promise<BoardPresence[]> {
  "use cache";
  cacheTag(BOARD_TAGS.presence);
  cacheLife("seconds");

  const rows = await prisma.presence.findMany({
    where: {
      startsOn: {
        lte: dbDateFromCalendarDate(addCalendarDays(from, horizonDays)),
      },
      OR: [{ endsOn: null }, { endsOn: { gte: dbDateFromCalendarDate(from) } }],
    },
    // `createdAt` last so that `coveringOn`, which resolves overlapping runs by taking the latest
    // element on a tie, gets last-write-wins rather than an arbitrary row.
    orderBy: [{ startsOn: "asc" }, { createdAt: "asc" }],
    select: PRESENCE_SELECT,
  });

  return rows.map(toBoardPresence);
}

/**
 * Every run for one person, earliest first.
 *
 * Ascending, unlike the editor list that preceded it, because the strip renders left to right
 * along a calendar rather than as a feed of recent entries.
 *
 * Unbounded on purpose: `setDays` folds new days into *all* of somebody's rows, so handing it
 * a windowed subset would let it merrily create a row overlapping one it could not see.
 */
export async function getPresenceForProfile(
  profileId: string,
): Promise<BoardPresence[]> {
  "use cache";
  cacheTag(BOARD_TAGS.presence);
  cacheLife("seconds");

  const rows = await prisma.presence.findMany({
    where: { profileId },
    orderBy: [{ startsOn: "asc" }, { createdAt: "asc" }],
    select: PRESENCE_SELECT,
  });

  return rows.map(toBoardPresence);
}

const PRESENCE_SELECT = {
  id: true,
  profileId: true,
  state: true,
  startsOn: true,
  endsOn: true,
  note: true,
} satisfies Prisma.PresenceSelect;

function toBoardPresence(
  row: Prisma.PresenceGetPayload<{ select: typeof PRESENCE_SELECT }>,
): BoardPresence {
  return {
    id: row.id,
    profileId: row.profileId,
    state: row.state,
    startsOn: calendarDateFromDbDate(row.startsOn),
    endsOn: row.endsOn ? calendarDateFromDbDate(row.endsOn) : null,
    note: row.note,
  };
}

export interface BoardEvent {
  id: string;
  title: string;
  date: CalendarDate;
  note: string | null;
}

/** Dated things that are not presence and not birthdays, within an inclusive window. */
export async function getEventsForWindow(
  from: CalendarDate,
  throughDays: number,
): Promise<BoardEvent[]> {
  "use cache";
  cacheTag(BOARD_TAGS.events);
  cacheLife("minutes");

  const events = await prisma.event.findMany({
    where: {
      date: {
        gte: dbDateFromCalendarDate(from),
        lte: dbDateFromCalendarDate(addCalendarDays(from, throughDays)),
      },
    },
    orderBy: [{ date: "asc" }, { title: "asc" }],
    select: { id: true, title: true, date: true, note: true },
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    date: calendarDateFromDbDate(event.date),
    note: event.note,
  }));
}

export type FamilyMembersData = Awaited<ReturnType<typeof getFamilyMembers>>;
export type PresenceData = Awaited<ReturnType<typeof getPresenceForWindow>>;
export type EventsData = Awaited<ReturnType<typeof getEventsForWindow>>;

/**
 * The rows one person has already said, read fresh.
 *
 * The uncached counterpart of `getPresenceForProfile`, and the one `setDays` is given. A cached
 * read would be a correctness bug rather than a stale one: folding a new run into a snapshot means
 * computing deletes against rows that may already be gone, so two people painting at once — or
 * one person tapping twice — would write overlapping rows against a calendar neither of them saw.
 *
 * `getPresenceForProfile` remains for the *rendering* path, where a second of staleness is only a
 * second of staleness.
 */
export async function getPresenceForProfileUncached(
  profileId: string,
): Promise<BoardPresence[]> {
  const rows = await prisma.presence.findMany({
    where: { profileId },
    orderBy: [{ startsOn: "asc" }, { createdAt: "asc" }],
    select: PRESENCE_SELECT,
  });
  return rows.map(toBoardPresence);
}

/**
 * The poll an option belongs to, and whether it is still open.
 *
 * The counterpart of `getPresenceForProfileUncached`, and uncached for a related reason: this is an
 * authorization input. A cached answer would keep reporting a poll as open after it settled, and a
 * late reply would then change a tally that an event was already written from.
 *
 * Narrow on purpose. The reply path needs to know two things, and loading the whole poll to learn
 * them would invite passing the rest of it somewhere it does not belong — and would drag in the
 * cached read this exists to avoid.
 */
export async function getPollForOption(
  optionId: string,
): Promise<{ pollId: string; status: PollStatus } | null> {
  const option = await prisma.pollOption.findUnique({
    where: { id: optionId },
    select: { pollId: true, poll: { select: { status: true } } },
  });
  return option ? { pollId: option.pollId, status: option.poll.status } : null;
}

export interface BoardPollOption extends PollOptionWindow {
  replies: PollReplyRecord[];
}

export interface BoardPoll {
  id: string;
  title: string;
  status: PollStatus;
  settledOptionId: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  options: BoardPollOption[];
}

/**
 * Polls, newest first, with their options and every reply.
 *
 * `cacheLife("seconds")`, deliberately against the "lifetimes are set by who writes the data" note
 * above. These *are* written only through a tagged Server Action, so by that rule they could live
 * for hours. But answering a poll is the
 * one screen where five people are looking at the same thing at once, and what each of them is
 * waiting to see is somebody else's avatar light up. A minute of staleness there is not a slightly
 * old board, it is the mechanic failing: you tap, nothing visibly happens, and you stop tapping.
 * Seconds is short enough that even a missed invalidation heals before anyone reads it as broken.
 */
export async function getPolls(): Promise<BoardPoll[]> {
  "use cache";
  cacheTag(BOARD_TAGS.polls);
  cacheLife("seconds");

  const polls = await prisma.poll.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: POLL_SELECT,
  });
  return polls.map(toBoardPoll);
}

/** One poll. `null` when the id does not exist — a shared link outliving its poll is ordinary. */
export async function getPoll(pollId: string): Promise<BoardPoll | null> {
  "use cache";
  cacheTag(BOARD_TAGS.polls);
  cacheLife("seconds");

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: POLL_SELECT,
  });
  return poll ? toBoardPoll(poll) : null;
}

/**
 * Who created a poll, or `null` when there is no such poll.
 *
 * Its own narrow query, and deliberately **not** cached, for the same reason
 * the presence read above is not: this is an authorization input. A cached answer would keep
 * naming whoever created the poll when the entry was written, so it must be read fresh every time
 * settle or delete asks whether the caller may.
 *
 * The outer `null` (no poll) and the inner one (creator's account removed) are different facts,
 * hence the wrapper rather than a bare `string | null`.
 */
export async function getPollCreatorUserId(
  pollId: string,
): Promise<{ createdById: string | null } | null> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { createdById: true },
  });
  return poll ? { createdById: poll.createdById } : null;
}

const POLL_SELECT = {
  id: true,
  title: true,
  status: true,
  settledOptionId: true,
  createdById: true,
  createdBy: { select: { name: true } },
  createdAt: true,
  options: {
    // `sortOrder` here and again in `sortOptions`: the query gives the rows a stable order, and
    // the pure sort makes that order total. Neither alone is enough.
    orderBy: [{ sortOrder: "asc" }, { startsOn: "asc" }, { id: "asc" }],
    select: {
      id: true,
      startsOn: true,
      endsOn: true,
      sortOrder: true,
      replies: {
        orderBy: { profileId: "asc" },
        select: { profileId: true, kind: true },
      },
    },
  },
} satisfies Prisma.PollSelect;

/**
 * Derived from the select rather than written out, so adding a column to one cannot silently
 * leave the other behind.
 */
type PollRow = Prisma.PollGetPayload<{ select: typeof POLL_SELECT }>;

function toBoardPoll(poll: PollRow): BoardPoll {
  return {
    id: poll.id,
    title: poll.title,
    status: poll.status,
    settledOptionId: poll.settledOptionId,
    createdById: poll.createdById,
    createdByName: poll.createdBy?.name ?? null,
    createdAt: poll.createdAt,
    options: poll.options.map((option) => ({
      optionId: option.id,
      startsOn: calendarDateFromDbDate(option.startsOn),
      endsOn: calendarDateFromDbDate(option.endsOn),
      sortOrder: option.sortOrder,
      replies: option.replies.map((reply) => ({
        optionId: option.id,
        profileId: reply.profileId,
        kind: reply.kind,
      })),
    })),
  };
}
