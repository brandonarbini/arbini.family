import {
  type CalendarDate,
  addCalendarDays,
  assertCalendarDate,
  compareCalendarDates,
} from "@/lib/dates";

/**
 * Birthdays on the board.
 *
 * Derived from `Profile.birthday` rather than stored as events, so a birthday cannot drift out of
 * sync with the person it belongs to, and correcting a typo in one place fixes it everywhere.
 *
 * The awkward part is that a birthday is a *recurring* date built from a one-off one, and the two
 * edge cases — the turn of the year and 29 February — are both easy to get wrong in ways that
 * only show up once a year.
 */

export interface BirthdayPerson {
  profileId: string;
  /** The full date of birth, including the year, so an age can be computed. */
  birthday: CalendarDate;
}

export interface UpcomingBirthday {
  profileId: string;
  /** The day it is observed this time round. */
  date: CalendarDate;
  /** The age they reach on `date`. */
  turning: number;
}

/**
 * The next time this birthday comes round, on or after `from`.
 *
 * "On or after" matters: a birthday that is *today* is the most interesting one the board can
 * show, and rolling it forward a year would be the one day it gets it wrong.
 */
export function nextBirthdayOccurrence(
  birthday: CalendarDate,
  from: CalendarDate,
): CalendarDate {
  const [, month, day] = assertCalendarDate(birthday, "birthday")
    .split("-")
    .map(Number);
  const fromYear = Number(assertCalendarDate(from, "from").slice(0, 4));

  const thisYear = observedOn(fromYear, month, day);
  if (compareCalendarDates(thisYear, from) >= 0) return thisYear;
  return observedOn(fromYear + 1, month, day);
}

/**
 * Birthdays falling within the window, earliest first.
 *
 * The window is inclusive at both ends, matching `upcomingTransitions` in lib/presence.ts — the
 * two feed the same list on the board, and a disagreement about whether the last day counts would
 * show up as a birthday and an arrival on the same date where only one of them appears.
 */
export function upcomingBirthdays(
  people: readonly BirthdayPerson[],
  from: CalendarDate,
  throughDays = 30,
): UpcomingBirthday[] {
  const start = assertCalendarDate(from, "from");
  if (throughDays < 0) return [];
  const end = addCalendarDays(start, throughDays);

  const upcoming: UpcomingBirthday[] = [];
  for (const person of people) {
    const date = nextBirthdayOccurrence(person.birthday, start);
    if (compareCalendarDates(date, end) > 0) continue;
    upcoming.push({
      profileId: person.profileId,
      date,
      // Both years are taken from the observed date rather than from a duration, so a 29 February
      // birth date observed on the 28th still reports the age they actually turn.
      turning: Number(date.slice(0, 4)) - Number(person.birthday.slice(0, 4)),
    });
  }

  // Total order, not just by date: two birthdays on one day must not swap between renders.
  return upcoming.sort(
    (a, b) =>
      compareCalendarDates(a.date, b.date) ||
      a.profileId.localeCompare(b.profileId),
  );
}

/**
 * The day a birthday is observed in a given year.
 *
 * 29 February is observed on the 28th in common years. The alternative — 1 March — would push it
 * into a different month, and a family board that lists "March" birthdays is a worse answer than
 * one that observes it a day early. What matters most is that it is never skipped: three years in
 * four are common years, so a naive implementation makes the birthday disappear almost always.
 */
function observedOn(year: number, month: number, day: number): CalendarDate {
  const effectiveDay =
    month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(effectiveDay, 2)}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
