import type { UpcomingBirthday } from "@/lib/board/birthdays";
import { type CalendarDate, compareCalendarDates } from "@/lib/dates";
import type { Transition } from "@/lib/presence";

/**
 * The board's "what's coming up" list.
 *
 * Three sources feed it — travel, birthdays and one-off events — and they have to interleave into
 * a single chronological list rather than three stacked ones. Somebody arriving on the 20th and
 * somebody's birthday on the 20th belong next to each other; splitting them by type makes the
 * reader do the merge in their head.
 *
 * Pure: takes the already-computed pieces and returns a sorted list, so the ordering rules are
 * testable without a database or a clock.
 */

export type AgendaEntry =
  | {
      kind: "arrival" | "departure";
      date: CalendarDate;
      profileId: string;
      placeId: string;
    }
  | {
      kind: "birthday";
      date: CalendarDate;
      profileId: string;
      turning: number;
    }
  | {
      kind: "event";
      date: CalendarDate;
      eventId: string;
      title: string;
      note: string | null;
    };

export interface AgendaSources {
  transitions: readonly Transition[];
  birthdays: readonly UpcomingBirthday[];
  events: readonly {
    id: string;
    date: CalendarDate;
    title: string;
    note: string | null;
  }[];
}

/**
 * Within a single day, entries are ordered by *what they are* rather than by when they were
 * created: a birthday is the headline, then people showing up, then people leaving, then
 * everything else. Any fixed order would do — what matters is that it is fixed, so a re-fetch
 * cannot reshuffle a day and make the list appear to change when nothing has.
 */
const KIND_ORDER: Record<AgendaEntry["kind"], number> = {
  birthday: 0,
  arrival: 1,
  departure: 2,
  event: 3,
};

export function buildAgenda({
  transitions,
  birthdays,
  events,
}: AgendaSources): AgendaEntry[] {
  const entries: AgendaEntry[] = [
    ...transitions.map((transition): AgendaEntry => ({
      kind: transition.kind,
      date: transition.date,
      profileId: transition.profileId,
      placeId: transition.placeId,
    })),
    ...birthdays.map((birthday): AgendaEntry => ({
      kind: "birthday",
      date: birthday.date,
      profileId: birthday.profileId,
      turning: birthday.turning,
    })),
    ...events.map((event): AgendaEntry => ({
      kind: "event",
      date: event.date,
      eventId: event.id,
      title: event.title,
      note: event.note,
    })),
  ];

  // Sorted to a total order. Falling back to the entry's own identifier is what makes this
  // deterministic rather than merely mostly-sorted — `Array.prototype.sort` is stable, but the
  // inputs arrive from three separate queries whose relative order is not guaranteed.
  return entries.sort(
    (a, b) =>
      compareCalendarDates(a.date, b.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      identity(a).localeCompare(identity(b)),
  );
}

function identity(entry: AgendaEntry): string {
  return entry.kind === "event" ? entry.eventId : entry.profileId;
}
