import {
  type CalendarDate,
  addCalendarDays,
  assertCalendarDate,
  compareCalendarDates,
  eachCalendarDay,
} from "@/lib/dates";

/**
 * Where everyone is, derived from stays.
 *
 * Presence is modelled as a date range at a place rather than a status field on a person, and
 * every question the board asks falls out of that one shape: who is where today, who arrives or
 * leaves this month, and when all five are next under one roof. A status field would answer only
 * the first, and would need updating by hand the moment it changed.
 *
 * These functions take plain objects rather than Prisma rows so the logic is testable without a
 * database — the caller maps rows to `StayWindow` at the boundary.
 *
 * ## Declared defaults
 *
 * Most of this family lives at home and only a couple of them go anywhere, so requiring a stay for
 * every ordinary day would mean recording nothing but the absence of news. `locationsOn` and
 * `findNextGathering` therefore accept an optional map of *declared* defaults — `Profile.
 * defaultPlaceId`, where somebody resides — and fall back to it on days no stay covers.
 *
 * This is not the board quietly assuming everyone is home. That assumption is exactly what the
 * "not recorded" state exists to prevent, because a countdown built on a guess is wrong in the
 * one case anybody would act on. A declared default is data: a person said where they live. The
 * distinction being preserved is *we know* versus *we don't* — not *recorded* versus *unrecorded*.
 * A profile with no default still resolves to `null`, and `findNextGathering` still declines to
 * report a gathering while anybody is unknown.
 *
 * The parameter is optional, so a caller that passes nothing gets the old behaviour exactly.
 */

/**
 * Where each person lives when no stay says otherwise. Keyed by profile id; a `null` value is a
 * person with no declared home, which resolves to unknown rather than to anywhere.
 */
export type DefaultPlaces = ReadonlyMap<string, string | null>;

export interface StayWindow {
  profileId: string;
  placeId: string;
  startsOn: CalendarDate;
  /** Last day at this place. `null` means open-ended — they are there until told otherwise. */
  endsOn: CalendarDate | null;
}

export interface Gathering {
  date: CalendarDate;
  placeId: string;
}

export type TransitionKind = "arrival" | "departure";

export interface Transition {
  kind: TransitionKind;
  date: CalendarDate;
  profileId: string;
  placeId: string;
}

/**
 * Does this stay cover the given day?
 *
 * `endsOn` is inclusive — it is the last day at the place, not the day they leave. A one-night
 * stay is therefore `startsOn === endsOn`, which is what someone filling in the form expects
 * when they put the same date in both boxes.
 */
export function stayCoversDate(stay: StayWindow, date: CalendarDate): boolean {
  const day = assertCalendarDate(date, "date");
  if (compareCalendarDates(stay.startsOn, day) > 0) return false;
  if (stay.endsOn === null) return true;
  return compareCalendarDates(day, stay.endsOn) <= 0;
}

/**
 * Each profile's place on a given day, or `null` where nothing is recorded and no default applies.
 *
 * Overlapping stays for one person are a data error the UI should prevent, but the board still
 * has to render something when it happens. The most recently started stay wins, on the theory
 * that it is the more recent statement of intent; exact `startsOn` ties are broken by input
 * order, so callers ordering by `createdAt` get last-write-wins.
 *
 * A stay always beats the default — being somewhere is a statement about a specific day, and a
 * default is a statement about ordinary ones.
 */
export function locationsOn(
  stays: readonly StayWindow[],
  profileIds: readonly string[],
  date: CalendarDate,
  defaults?: DefaultPlaces,
): Map<string, string | null> {
  return new Map(
    Array.from(staysOn(stays, profileIds, date), ([profileId, stay]) => [
      profileId,
      stay?.placeId ?? defaults?.get(profileId) ?? null,
    ]),
  );
}

/**
 * Each profile's governing stay on a given day, or `null` where nothing is recorded.
 *
 * The same resolution `locationsOn` performs, but handing back the whole stay — the board shows
 * not just *where* someone is but *until when*, and that needs `endsOn`. `locationsOn` is defined
 * in terms of this so the tie-breaking rule exists in exactly one place; two copies of it would
 * be free to disagree about which stay wins, and the board would then contradict itself about a
 * person's place and their departure date.
 */
export function staysOn(
  stays: readonly StayWindow[],
  profileIds: readonly string[],
  date: CalendarDate,
): Map<string, StayWindow | null> {
  const day = assertCalendarDate(date, "date");
  const wanted = new Set(profileIds);
  const best = new Map<string, StayWindow>();

  for (const stay of stays) {
    if (!wanted.has(stay.profileId)) continue;
    if (!stayCoversDate(stay, day)) continue;
    const incumbent = best.get(stay.profileId);
    // `>= 0` rather than `> 0`: on an exact tie the later element replaces the earlier one.
    if (
      !incumbent ||
      compareCalendarDates(stay.startsOn, incumbent.startsOn) >= 0
    ) {
      best.set(stay.profileId, stay);
    }
  }

  return new Map(
    profileIds.map((profileId) => [profileId, best.get(profileId) ?? null]),
  );
}

/**
 * The next day every profile is at the same place, searching forward from `from`.
 *
 * "The same place" rather than "at home" on purpose — Thanksgiving at Grandma's is the family
 * being together, and a countdown that ignored it would be wrong in exactly the case people care
 * most about.
 *
 * Walks the horizon a day at a time. With five people and a year to scan this is a few thousand
 * comparisons, so an interval-intersection algorithm would buy nothing but a place for an
 * off-by-one to hide.
 */
export function findNextGathering(
  stays: readonly StayWindow[],
  profileIds: readonly string[],
  from: CalendarDate,
  horizonDays = 365,
  defaults?: DefaultPlaces,
): Gathering | null {
  // Vacuously true is the wrong answer here: with nobody to gather, there is no gathering. The
  // `shared !== null` test below already declines to report one, so this is an explicit statement
  // of intent and an early exit rather than the only thing preventing it — worth keeping so a
  // later change to that condition cannot quietly reintroduce a countdown to an empty family.
  if (profileIds.length === 0) return null;

  const start = assertCalendarDate(from, "from");
  if (horizonDays < 0) return null;

  for (const day of eachCalendarDay(
    start,
    addCalendarDays(start, horizonDays),
  )) {
    const places = locationsOn(stays, profileIds, day, defaults);
    let shared: string | null = null;
    let together = true;

    for (const placeId of places.values()) {
      if (placeId === null) {
        together = false;
        break;
      }
      if (shared === null) {
        shared = placeId;
      } else if (shared !== placeId) {
        together = false;
        break;
      }
    }

    if (together && shared !== null) return { date: day, placeId: shared };
  }

  return null;
}

/**
 * Arrivals and departures falling within the window, earliest first.
 *
 * An open-ended stay contributes an arrival and no departure — there is no date on which they
 * leave, so reporting one would be an invention.
 *
 * A stay that starts and ends on the same day contributes only an arrival. "Addison arrives at
 * Home" and "Addison leaves Home" filed against one date is two lines for one visit, and it reads
 * as a glitch rather than as detail. This used to be a rarity, because a stay somebody typed by
 * hand is usually a trip; settling a poll writes one for every day the family agrees on, so the
 * day visit is now the common case rather than the odd one.
 */
export function upcomingTransitions(
  stays: readonly StayWindow[],
  from: CalendarDate,
  throughDays = 30,
): Transition[] {
  const start = assertCalendarDate(from, "from");
  if (throughDays < 0) return [];
  const end = addCalendarDays(start, throughDays);

  const inWindow = (date: CalendarDate) =>
    compareCalendarDates(date, start) >= 0 &&
    compareCalendarDates(date, end) <= 0;

  const transitions: Transition[] = [];
  for (const stay of stays) {
    if (inWindow(stay.startsOn)) {
      transitions.push({
        kind: "arrival",
        date: stay.startsOn,
        profileId: stay.profileId,
        placeId: stay.placeId,
      });
    }
    if (
      stay.endsOn !== null &&
      stay.endsOn !== stay.startsOn &&
      inWindow(stay.endsOn)
    ) {
      transitions.push({
        kind: "departure",
        date: stay.endsOn,
        profileId: stay.profileId,
        placeId: stay.placeId,
      });
    }
  }

  // Sorted to a total order, not just by date: two events on the same day must not swap places
  // between renders, or the board flickers when it re-fetches.
  return transitions.sort(
    (a, b) =>
      compareCalendarDates(a.date, b.date) ||
      a.kind.localeCompare(b.kind) ||
      a.profileId.localeCompare(b.profileId),
  );
}
