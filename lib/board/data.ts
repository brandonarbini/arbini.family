import "server-only";

import type { FamilyRole } from "@/generated/prisma/enums";
import {
  type CalendarDate,
  addCalendarDays,
  calendarDateFromDbDate,
  dbDateFromCalendarDate,
} from "@/lib/dates";
import type { StayWindow } from "@/lib/presence";
import { prisma } from "@/lib/prisma";

/**
 * Shared reads for the family board.
 *
 * Lives in `/lib` rather than beside a route because both `/home` and `/home/where` need the same
 * rows, and a webhook or script would too.
 *
 * This module is also the *boundary*: `@db.Date` columns are converted to `CalendarDate` strings
 * here and nowhere else, so nothing downstream ever holds a `Date` it might format in the wrong
 * zone. Everything below returns plain data that `lib/presence.ts` and `lib/board/birthdays.ts`
 * can be tested against without a database.
 *
 * No `auth()` here by design — entry points authorize, queries read. There is exactly one family,
 * so there is no tenant key to scope by.
 */

/** How far ahead `findNextGathering` may look, and therefore how many stays are worth loading. */
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

export interface Place {
  id: string;
  name: string;
  address: string | null;
  isHome: boolean;
}

export async function getPlaces(): Promise<Place[]> {
  const places = await prisma.place.findMany({
    orderBy: [{ isHome: "desc" }, { name: "asc" }],
    select: { id: true, name: true, address: true, isHome: true },
  });
  return places;
}

export interface BoardStay extends StayWindow {
  id: string;
  note: string | null;
}

/**
 * Stays that could matter to a board rendered on `from`.
 *
 * Bounded on both sides. Without the lower bound every stay the family has ever recorded gets
 * loaded to answer a question about this month; without the upper bound a stay booked years out
 * is loaded to be ignored. The window matches what `findNextGathering` can actually see, so
 * narrowing it further would change answers rather than just save bytes.
 *
 * An open-ended stay (`endsOn: null`) is always a candidate — it has no end to fall before the
 * window.
 */
export async function getStaysForWindow(
  from: CalendarDate,
  horizonDays: number = GATHERING_HORIZON_DAYS,
): Promise<BoardStay[]> {
  const stays = await prisma.stay.findMany({
    where: {
      startsOn: {
        lte: dbDateFromCalendarDate(addCalendarDays(from, horizonDays)),
      },
      OR: [{ endsOn: null }, { endsOn: { gte: dbDateFromCalendarDate(from) } }],
    },
    // `createdAt` last so that `locationsOn`, which resolves overlapping stays by taking the
    // latest element on a tie, gets last-write-wins rather than an arbitrary row.
    orderBy: [{ startsOn: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      profileId: true,
      placeId: true,
      startsOn: true,
      endsOn: true,
      note: true,
    },
  });

  return stays.map((stay) => ({
    id: stay.id,
    profileId: stay.profileId,
    placeId: stay.placeId,
    startsOn: calendarDateFromDbDate(stay.startsOn),
    endsOn: stay.endsOn ? calendarDateFromDbDate(stay.endsOn) : null,
    note: stay.note,
  }));
}

/** Every stay for one person, newest first — the editing list on `/home/where`. */
export async function getStaysForProfile(
  profileId: string,
): Promise<BoardStay[]> {
  const stays = await prisma.stay.findMany({
    where: { profileId },
    orderBy: [{ startsOn: "desc" }],
    select: {
      id: true,
      profileId: true,
      placeId: true,
      startsOn: true,
      endsOn: true,
      note: true,
    },
  });

  return stays.map((stay) => ({
    id: stay.id,
    profileId: stay.profileId,
    placeId: stay.placeId,
    startsOn: calendarDateFromDbDate(stay.startsOn),
    endsOn: stay.endsOn ? calendarDateFromDbDate(stay.endsOn) : null,
    note: stay.note,
  }));
}

export interface BoardEvent {
  id: string;
  title: string;
  date: CalendarDate;
  note: string | null;
}

/** Dated things that are not stays and not birthdays, within an inclusive window. */
export async function getEventsForWindow(
  from: CalendarDate,
  throughDays: number,
): Promise<BoardEvent[]> {
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
export type PlacesData = Awaited<ReturnType<typeof getPlaces>>;
export type StaysData = Awaited<ReturnType<typeof getStaysForWindow>>;
export type EventsData = Awaited<ReturnType<typeof getEventsForWindow>>;

/**
 * Which profile a stay belongs to, or `null` when there is no such stay.
 *
 * Its own narrow query because the edit and delete actions need the owner *before* they touch the
 * row, to decide whether the caller may. Loading the whole stay to read one column would invite
 * passing the rest of it somewhere it does not belong.
 */
export async function getStayOwnerProfileId(
  stayId: string,
): Promise<string | null> {
  const stay = await prisma.stay.findUnique({
    where: { id: stayId },
    select: { profileId: true },
  });
  return stay?.profileId ?? null;
}
