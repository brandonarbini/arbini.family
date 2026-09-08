import type { CalendarDateString } from '@server/api/v1/dto';

/**
 * Formatting for calendar dates, the native counterpart of the display half of `lib/dates.ts`.
 *
 * Only formatting. The app never decides *which day it is* — the server resolves "today" in the
 * family's timezone and sends it, because a phone in another timezone computing its own would
 * show a different board than the one on the fridge.
 *
 * Two things this file exists to get right:
 *
 * **The off-by-one.** Every date here is a `YYYY-MM-DD` string, which is a date and not an
 * instant. `new Date('2026-09-07')` parses as UTC midnight and then renders in the device's zone,
 * which in Los Angeles is `Sun Sep 06` — the previous day. So the parts are read by hand and
 * formatted back in UTC, which cannot shift them.
 *
 * **Matching the web's typography.** The web sets these with date-fns patterns (`EEEE d MMMM
 * yyyy`, `d MMM`). `Intl` with a locale does not reproduce them: en-GB inserts a comma after the
 * weekday and abbreviates September to "Sept". So the pieces are taken from `formatToParts` and
 * assembled here, which puts the separators under this file's control rather than the locale's.
 */

function toUtcDate(date: CalendarDateString): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

type Parts = {
  weekdayLong: string;
  weekdayShort: string;
  day: string;
  monthLong: string;
  monthShort: string;
  year: string;
};

function partsOf(date: CalendarDateString): Parts {
  const value = toUtcDate(date);
  const pick = (options: Intl.DateTimeFormatOptions, type: Intl.DateTimeFormatPartTypes) =>
    new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' })
      .formatToParts(value)
      .find((part) => part.type === type)?.value ?? '';

  return {
    weekdayLong: pick({ weekday: 'long' }, 'weekday'),
    // en-GB's short September is "Sept"; date-fns' MMM is always three letters. Truncating is
    // what keeps the two clients spelling the same date the same way.
    weekdayShort: pick({ weekday: 'short' }, 'weekday').slice(0, 3),
    day: pick({ day: 'numeric' }, 'day'),
    monthLong: pick({ month: 'long' }, 'month'),
    monthShort: pick({ month: 'short' }, 'month').slice(0, 3),
    year: pick({ year: 'numeric' }, 'year'),
  };
}

/** `EEEE d MMMM yyyy` — "Monday 7 September 2026". The masthead dateline. */
export function formatDateline(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${p.weekdayLong} ${p.day} ${p.monthLong} ${p.year}`;
}

/** `EEEE d MMMM` — "Sunday 13 September". Under the lede. */
export function formatLongDay(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${p.weekdayLong} ${p.day} ${p.monthLong}`;
}

/** `d MMM` — "12 Sep". The tight form used inside a row. */
export function formatShortDay(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${p.day} ${p.monthShort}`;
}

/** `EEE d MMM` — "Sat 12 Sep". The agenda's default stand-first. */
export function formatWeekdayShort(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${p.weekdayShort} ${p.day} ${p.monthShort}`;
}

/** Whole days from `from` to `date`, both calendar dates. Negative when `date` is in the past. */
export function daysBetween(from: CalendarDateString, date: CalendarDateString): number {
  return Math.round((toUtcDate(date).getTime() - toUtcDate(from).getTime()) / 86_400_000);
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
  return formatWeekdayShort(date);
}
