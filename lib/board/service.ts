import "server-only";

import { type CalendarDate, dbDateFromCalendarDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/**
 * Write-path logic for the board.
 *
 * Auth-free on purpose: the caller — a Server Action, a script, a future webhook — has already
 * established who is acting and whether they may. Keeping that out of here is what lets these be
 * exercised without route plumbing, and stops the authorization rule from being duplicated in
 * three places that can disagree.
 */

export interface StayInput {
  profileId: string;
  placeId: string;
  startsOn: CalendarDate;
  /** `null` means open-ended: there until told otherwise. */
  endsOn: CalendarDate | null;
  note: string | null;
}

export async function createStay(input: StayInput): Promise<{ id: string }> {
  const stay = await prisma.stay.create({
    data: toRow(input),
    select: { id: true },
  });
  return stay;
}

export async function updateStay(
  stayId: string,
  input: StayInput,
): Promise<void> {
  await prisma.stay.update({ where: { id: stayId }, data: toRow(input) });
}

export async function deleteStay(stayId: string): Promise<void> {
  await prisma.stay.delete({ where: { id: stayId } });
}

/**
 * `endsOn` is the last day *at* the place, so a same-day value is a legitimate one-night stay
 * rather than an empty range. Enforced in `validations.ts` too, where it can produce a field
 * error; repeated here because this module is callable without going through a form.
 */
export function isValidRange(
  startsOn: CalendarDate,
  endsOn: CalendarDate | null,
): boolean {
  return endsOn === null || endsOn >= startsOn;
}

function toRow(input: StayInput) {
  if (!isValidRange(input.startsOn, input.endsOn)) {
    throw new Error(
      `Stay ends (${input.endsOn}) before it starts (${input.startsOn})`,
    );
  }
  return {
    profileId: input.profileId,
    placeId: input.placeId,
    startsOn: dbDateFromCalendarDate(input.startsOn),
    endsOn: input.endsOn ? dbDateFromCalendarDate(input.endsOn) : null,
    // Empty is absent. A whitespace-only note renders as a blank line on the board.
    note: input.note?.trim() ? input.note.trim() : null,
  };
}
