import { formatInTimeZone } from "date-fns-tz";
import { FAMILY_TIMEZONE } from "@/lib/constants/timezone";

/**
 * Calendar-date arithmetic for the family board.
 *
 * Dates here are `YYYY-MM-DD` strings, never `Date` objects. That is the whole defence against
 * the bug this feature is most prone to: "it says Ellie comes home tomorrow but she's here." A
 * `Date` is an instant, and an instant rendered in two timezones is two different days — so a
 * stay starting on the 20th silently becomes the 19th for whoever is furthest west. A string has
 * no offset to get wrong, and ISO order is lexicographic order, so `<` and `>` compare dates
 * correctly with no library at all.
 *
 * `Date` appears in exactly two places: `todayInFamilyTz`, which needs a clock, and the Prisma
 * `@db.Date` converters at the bottom. Nothing in between touches one.
 */

/** A `YYYY-MM-DD` calendar date. See the module comment for why this is a string. */
export type CalendarDate = string;

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a well-formed date that also exists — `2026-02-30` matches the shape but is not a day. */
export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  // Date.UTC normalizes out-of-range parts (Feb 30 -> Mar 2), so a round-trip that comes back
  // unchanged is the cheapest proof the date is real.
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

export function assertCalendarDate(
  value: unknown,
  label = "value",
): CalendarDate {
  if (!isCalendarDate(value)) {
    throw new TypeError(
      `${label} must be a YYYY-MM-DD calendar date, received ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Today, as the family reckons it.
 *
 * `now` is injectable so the board's date-dependent logic is testable without freezing the system
 * clock. Callers in app code should let it default.
 */
export function todayInFamilyTz(now: Date = new Date()): CalendarDate {
  return formatInTimeZone(now, FAMILY_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Shift a calendar date by whole days.
 *
 * Deliberately computed in UTC. Adding 24 hours to a *local* timestamp lands on the same clock
 * time only when no DST transition intervenes — on the spring-forward day it lands on the same
 * calendar day, and "tomorrow" quietly becomes "today". UTC has no transitions, and since the
 * input and output are both offset-free strings, borrowing UTC to do the arithmetic is safe.
 */
export function addCalendarDays(
  date: CalendarDate,
  days: number,
): CalendarDate {
  const [year, month, day] = assertCalendarDate(date, "date")
    .split("-")
    .map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatUtcDate(shifted);
}

/** Negative when `a` is earlier, positive when later, zero when the same day. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  const left = assertCalendarDate(a, "a");
  const right = assertCalendarDate(b, "b");
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function differenceInCalendarDays(
  from: CalendarDate,
  to: CalendarDate,
): number {
  const start = utcInstant(assertCalendarDate(from, "from"));
  const end = utcInstant(assertCalendarDate(to, "to"));
  // Both instants are UTC midnight, so the gap is always an exact multiple of a day — no DST
  // remainder to round away.
  return Math.round((end - start) / 86_400_000);
}

/** Every day from `from` through `through`, inclusive. Empty when `through` precedes `from`. */
export function eachCalendarDay(
  from: CalendarDate,
  through: CalendarDate,
): CalendarDate[] {
  const span = differenceInCalendarDays(from, through);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, offset) =>
    addCalendarDays(from, offset),
  );
}

/**
 * Read a Prisma `@db.Date` column as a calendar date.
 *
 * Formatted in **UTC, not `FAMILY_TIMEZONE`**. A `date` column arrives as midnight UTC, and
 * rendering midnight UTC in a west-of-Greenwich zone yields the previous day — the exact
 * off-by-one this module exists to prevent. The column carries no time and no zone; UTC here is
 * just how the driver hands it over.
 */
export function calendarDateFromDbDate(value: Date): CalendarDate {
  return formatUtcDate(value);
}

/** Build the UTC-midnight `Date` a Prisma `@db.Date` column expects. */
export function dbDateFromCalendarDate(value: CalendarDate): Date {
  return new Date(utcInstant(assertCalendarDate(value, "value")));
}

function utcInstant(date: CalendarDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatUtcDate(value: Date): CalendarDate {
  const year = String(value.getUTCFullYear()).padStart(4, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Render a calendar date for display.
 *
 * Formatted in **UTC**, for the same reason `calendarDateFromDbDate` is: the string is turned
 * back into a UTC-midnight instant to be formatted, and rendering that instant in
 * `FAMILY_TIMEZONE` — or worse, in the viewer's own zone — moves it to the previous day for
 * anyone west of Greenwich. Formatting is the last place this bug can be reintroduced, which is
 * why it lives here next to the rule rather than being done ad hoc at each call site.
 */
export function formatCalendarDate(
  date: CalendarDate,
  pattern = "EEE d MMM",
): string {
  return formatInTimeZone(
    dbDateFromCalendarDate(assertCalendarDate(date, "date")),
    "UTC",
    pattern,
  );
}

/**
 * A relative phrase for a date near today — "today", "tomorrow", "in 6 days".
 *
 * Beyond a week it returns `null` rather than "in 43 days", which reads as arithmetic rather than
 * as language; the caller falls back to the date itself.
 */
export function describeRelativeDay(
  date: CalendarDate,
  today: CalendarDate,
): string | null {
  const days = differenceInCalendarDays(today, date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days <= 7) return `in ${days} days`;
  return null;
}
