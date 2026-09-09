import type { CalendarDateString } from '@server/api/v1/dto';

/**
 * Formatting for calendar dates, the native counterpart of the display half of `lib/dates.ts`.
 *
 * Only formatting. The app never decides *which day it is* — the server resolves "today" in the
 * family's timezone and sends it, because a phone in another timezone computing its own would show
 * a different board than the one on the fridge.
 *
 * **No `Intl` here, deliberately.** The obvious implementation asks `Intl.DateTimeFormat` for a
 * weekday and a month name, and it works perfectly in Node — which is exactly what makes it a
 * trap. Hermes ships a cut-down ICU, and on device those parts come back empty: the masthead read
 * "7  2026" and the lede "13  at Home", with the numbers present and every name missing. So the
 * names are tabulated here.
 *
 * That is not merely a workaround. The web sets these with date-fns patterns (`EEEE d MMMM yyyy`,
 * `d MMM`) in English, and a table reproduces them exactly, where a locale-aware formatter would
 * drift — en-GB writes "Monday, 7 September" with a comma and abbreviates September to "Sept".
 *
 * The other rule this file exists for: a `YYYY-MM-DD` is a date, not an instant.
 * `new Date('2026-09-07')` parses as UTC midnight and renders in the device's zone, which in Los
 * Angeles is `Sun Sep 06` — the previous day. Everything below reads the parts by hand.
 */

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** date-fns `EEE`: the first three letters of the long form. */
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** date-fns `MMM`: always three letters, so September is "Sep" and not "Sept". */
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

interface DateParts {
  weekday: number;
  day: number;
  monthIndex: number;
  year: number;
}

function partsOf(date: CalendarDateString): DateParts {
  const [year, month, day] = date.split('-').map(Number);
  // UTC throughout: the point is to never let a timezone move the day.
  const utc = new Date(Date.UTC(year, month - 1, day));
  return { weekday: utc.getUTCDay(), day, monthIndex: month - 1, year };
}

/** `EEEE d MMMM yyyy` — "Monday 7 September 2026". The masthead dateline. */
export function formatDateline(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${WEEKDAYS_LONG[p.weekday]} ${p.day} ${MONTHS_LONG[p.monthIndex]} ${p.year}`;
}

/** `EEEE d MMMM` — "Sunday 13 September". Under the lede. */
export function formatLongDay(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${WEEKDAYS_LONG[p.weekday]} ${p.day} ${MONTHS_LONG[p.monthIndex]}`;
}

/**
 * `EEEEE` — "M", "T", "W". The single letter over a strip or grid cell.
 *
 * Ambiguous on its own — Tuesday and Thursday are both "T" — and that is fine here, because the
 * letter sits directly above the date and the column is read as a position in a week rather than
 * as a name. Two letters would be the wrong trade at this width.
 */
export function formatWeekdayInitial(date: CalendarDateString): string {
  return WEEKDAYS_LONG[partsOf(date).weekday].slice(0, 1);
}

/** `d` — the day of the month alone, for a cell that already sits under its weekday. */
export function formatDayOfMonth(date: CalendarDateString): string {
  return String(partsOf(date).day);
}

/**
 * Shift a calendar date by whole days, in UTC.
 *
 * The app does not decide what *today* is — the server sends that — but it does have to walk
 * forward from it to lay out a strip. UTC because a local shift lands on the same calendar day
 * across a spring-forward, and "tomorrow" quietly becomes "today".
 */
export function addDays(date: CalendarDateString, days: number): CalendarDateString {
  const p = partsOf(date);
  const shifted = new Date(Date.UTC(p.year, p.monthIndex, p.day + days));
  return [
    String(shifted.getUTCFullYear()).padStart(4, '0'),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** `d MMM` — "12 Sep". The tight form used inside a row. */
export function formatShortDay(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${p.day} ${MONTHS_SHORT[p.monthIndex]}`;
}

/** `EEE d MMM` — "Sat 12 Sep". The agenda's default stand-first. */
export function formatWeekdayShort(date: CalendarDateString): string {
  const p = partsOf(date);
  return `${WEEKDAYS_SHORT[p.weekday]} ${p.day} ${MONTHS_SHORT[p.monthIndex]}`;
}

/** Whole days from `from` to `date`, both calendar dates. Negative when `date` is in the past. */
export function daysBetween(from: CalendarDateString, date: CalendarDateString): number {
  const a = partsOf(from);
  const b = partsOf(date);
  const ms = Date.UTC(b.year, b.monthIndex, b.day) - Date.UTC(a.year, a.monthIndex, a.day);
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
  // Past a week, the weekday alone stops identifying a day: a 30-day agenda has four Saturdays and
  // the column exists so the eye can run down *dates*. The web makes the same cut at seven days.
  if (days > 1 && days <= 7) return formatWeekdayShort(date);
  return formatShortDay(date);
}
