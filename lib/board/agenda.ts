import type { UpcomingBirthday } from "@/lib/board/birthdays";
import { type CalendarDate, compareCalendarDates } from "@/lib/dates";

/**
 * The board's "what else is coming up" list.
 *
 * Two sources feed it — birthdays and one-off events — and they interleave into a single
 * chronological list rather than two stacked ones. A birthday on the 20th and a graduation on the
 * 20th belong next to each other; splitting them by type makes the reader do the merge.
 *
 * It used to carry arrivals and departures too, and that is what made it unreadable: a weekend
 * everyone is home produced five near-identical lines saying what the grid above already showed
 * at a glance. What is left is the part the grid *cannot* show — a birthday, a graduation, a date
 * the family settled on — which is why the section survived at all.
 *
 * Pure: takes the already-computed pieces and returns a sorted list, so the ordering rules are
 * testable without a database or a clock.
 */

export type AgendaEntry =
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
  birthdays: readonly UpcomingBirthday[];
  events: readonly {
    id: string;
    date: CalendarDate;
    title: string;
    note: string | null;
  }[];
}

/**
 * Within a single day, a birthday leads and everything else follows. Any fixed order would do —
 * what matters is that it is fixed, so a re-fetch cannot reshuffle a day and make the list appear
 * to change when nothing has.
 */
const KIND_ORDER: Record<AgendaEntry["kind"], number> = {
  birthday: 0,
  event: 1,
};

export function buildAgenda({
  birthdays,
  events,
}: AgendaSources): AgendaEntry[] {
  const entries: AgendaEntry[] = [
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
  // inputs arrive from separate queries whose relative order is not guaranteed.
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
