import type { CalendarDateString } from '@server/api/v1/dto';

/**
 * Formatting for calendar dates, the native counterpart of the display half of `lib/dates.ts`.
 *
 * Only formatting. The app never decides *which day it is* — the server resolves "today" in the
 * family's timezone and sends it, because a phone in another timezone computing its own would
 * show a different board than the one on the fridge.
 *
 * Every date here is a `YYYY-MM-DD` string, which is a date and not an instant. `new Date(str)`
 * would parse it as UTC midnight and then render it in the device's zone, which west of Greenwich
 * is the previous evening — the classic off-by-one-day. So the parts are read by hand and
 * formatted back in UTC, which never shifts them.
 */

function toUtcDate(date: CalendarDateString): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function format(date: CalendarDateString, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(toUtcDate(date));
}

/** "Sunday 7 September 2026" — the masthead dateline. */
export function formatDateline(date: CalendarDateString): string {
  return format(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "Friday 19 September" — under the lede. */
export function formatLongDay(date: CalendarDateString): string {
  return format(date, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "12 Sep" — the tight form used inside a row. */
export function formatShortDay(date: CalendarDateString): string {
  return format(date, { day: 'numeric', month: 'short' });
}

/** Whole days from `from` to `date`, both calendar dates. Negative when `date` is in the past. */
export function daysBetween(from: CalendarDateString, date: CalendarDateString): number {
  const ms = toUtcDate(date).getTime() - toUtcDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * "Today", "Tomorrow", or a short date — the agenda's stand-first.
 *
 * Named days only reach two ahead. Beyond that "in 6 days" makes the reader do arithmetic to place
 * it in a week, which a date does not.
 */
export function describeRelativeDay(date: CalendarDateString, today: CalendarDateString): string {
  const days = daysBetween(today, date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return format(date, { weekday: 'short', day: 'numeric', month: 'short' });
}
