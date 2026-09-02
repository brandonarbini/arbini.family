import "server-only";

import { PollStatus, ReplyKind } from "@/generated/prisma/enums";
import {
  type CalendarDate,
  calendarDateFromDbDate,
  dbDateFromCalendarDate,
} from "@/lib/dates";
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

/**
 * Polls.
 *
 * Same contract as the stay writes above: auth-free, because the caller has already established
 * who is acting and whether they may.
 */

export interface PollOptionInput {
  startsOn: CalendarDate;
  /** Last day of the option, inclusive — matching `Stay`. A single day has matching dates. */
  endsOn: CalendarDate;
}

export interface PollInput {
  title: string;
  /** Where the gathering is. Null means "wherever home is", resolved when the poll settles. */
  placeId: string | null;
  /** The user who asked. Null only for a poll created outside a session. */
  createdById: string | null;
  options: readonly PollOptionInput[];
}

/**
 * Create a poll and its options in one transaction.
 *
 * `sortOrder` is assigned here from the *sorted* options rather than from input order, so the
 * ballot reads chronologically however the form happened to submit them. Duplicate dates are
 * dropped: two identical options are not a choice, and a tally split across them would understate
 * both.
 */
export async function createPoll(input: PollInput): Promise<{ id: string }> {
  const options = normalizeOptions(input.options);
  if (options.length === 0) {
    throw new Error("A poll needs at least one date");
  }

  const poll = await prisma.poll.create({
    data: {
      title: input.title.trim(),
      placeId: input.placeId,
      createdById: input.createdById,
      options: {
        create: options.map((option, index) => ({
          startsOn: dbDateFromCalendarDate(option.startsOn),
          endsOn: dbDateFromCalendarDate(option.endsOn),
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });
  return poll;
}

/**
 * Record one person's answer to one option.
 *
 * An upsert on the unique pair, so changing your mind updates the row rather than adding a second
 * one — which is the most likely thing to happen on a phone, and the thing that would otherwise
 * make the tally count somebody twice.
 *
 * `optionId` is trusted to belong to a poll the caller may answer because every option belongs to
 * a poll every family member may answer; there is no per-poll audience. What is *not* trusted is
 * `profileId`, which the action checks against the session before calling in.
 */
export async function replyToPoll(
  optionId: string,
  profileId: string,
  kind: ReplyKind,
): Promise<void> {
  await prisma.pollReply.upsert({
    where: { optionId_profileId: { optionId, profileId } },
    update: { kind },
    create: { optionId, profileId, kind },
  });
}

/** Clear one person's answer, putting them back to silent rather than to a no. */
export async function clearReply(
  optionId: string,
  profileId: string,
): Promise<void> {
  await prisma.pollReply.deleteMany({ where: { optionId, profileId } });
}

/**
 * Settle a poll on one of its own options, and write the result onto the board.
 *
 * The option is looked up scoped to the poll first. Without that scope a caller could settle a
 * poll on an option belonging to a different one, and the ballot would then render a chosen date
 * that appears nowhere among its own choices.
 *
 * Returns false rather than throwing on a mismatch, so the action can turn it into a field error;
 * a thrown error reaches the client as an opaque production digest.
 *
 * ## What settling writes
 *
 * One `Event`, always — the whole point of settling is that the date lands on the board's agenda
 * rather than living inside a poll nobody reopens.
 *
 * Then a `Stay`, but **only for people who said yes and who do not already live at the gathering
 * place.** Both halves of that are deliberate:
 *
 * - *Only yes.* Writing a stay for somebody who said no, or who never answered, would be the app
 *   inventing a fact about a person. That is the thing the board refuses to do everywhere else —
 *   it is why an unrecorded day reads "not recorded" rather than "home" — and settling a poll is
 *   not a licence to start.
 * - *Only travel.* Somebody whose declared home is already the gathering place needs no stay:
 *   `locationsOn` puts them there by default, so the row would add nothing to the board while
 *   adding five rows a week to the stay editor. A stay records the exception, which here means
 *   Addison coming home — the one fact nothing else in the system knows.
 *
 * The writes happen in a transaction that first clears anything a previous settlement left, so
 * settle → reopen → settle elsewhere leaves no ghosts. That idempotence is what makes this safe
 * to press twice.
 */
export async function settlePoll(
  pollId: string,
  optionId: string,
): Promise<boolean> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { title: true, placeId: true, createdById: true },
  });
  if (!poll) return false;

  const option = await prisma.pollOption.findFirst({
    where: { id: optionId, pollId },
    select: { id: true, startsOn: true, endsOn: true },
  });
  if (!option) return false;

  // Falls back to home when the poll named no place: a weekly "dinner together" is about the
  // house, and making somebody pick that every time is the friction this feature exists to avoid.
  const place =
    poll.placeId ??
    (
      await prisma.place.findFirst({
        where: { isHome: true },
        select: { id: true },
      })
    )?.id ??
    null;

  const travellers = place
    ? await prisma.pollReply.findMany({
        where: {
          optionId,
          kind: ReplyKind.YES,
          // The "only travel" half of the rule, expressed as a filter rather than as a loop over
          // everyone, so there is no window in which the wrong set has been assembled.
          profile: { NOT: { defaultPlaceId: place } },
        },
        select: { profileId: true },
      })
    : [];

  await prisma.$transaction([
    // Clear a previous settlement before writing this one, or the board accumulates every date
    // the family ever considered.
    prisma.event.deleteMany({ where: { pollId } }),
    prisma.stay.deleteMany({ where: { pollId } }),
    prisma.poll.update({
      where: { id: pollId },
      data: {
        status: PollStatus.SETTLED,
        settledOptionId: optionId,
        settledAt: new Date(),
      },
    }),
    prisma.event.create({
      data: {
        title: poll.title,
        // `Event` carries a single date, so a multi-day option is filed on its first day and says
        // so in the note. Widening the event model for this would ripple through the agenda for
        // the sake of a case the family hits a few times a year.
        date: option.startsOn,
        note: spansMoreThanOneDay(option) ? describeSpan(option) : null,
        createdById: poll.createdById,
        pollId,
      },
    }),
    ...travellers.map((reply) =>
      prisma.stay.create({
        data: {
          profileId: reply.profileId,
          placeId: place!,
          startsOn: option.startsOn,
          endsOn: option.endsOn,
          note: poll.title,
          pollId,
        },
      }),
    ),
  ]);

  return true;
}

/** Reopen a settled poll — somebody's plans changed, which is ordinary. */
export async function reopenPoll(pollId: string): Promise<void> {
  // The board has to stop claiming a gathering the moment the family stops agreeing on one, so
  // the derived rows go back out in the same transaction that reopens the poll.
  await prisma.$transaction([
    prisma.event.deleteMany({ where: { pollId } }),
    prisma.stay.deleteMany({ where: { pollId } }),
    prisma.poll.update({
      where: { id: pollId },
      data: { status: PollStatus.OPEN, settledOptionId: null, settledAt: null },
    }),
  ]);
}

function spansMoreThanOneDay(option: {
  startsOn: Date;
  endsOn: Date;
}): boolean {
  return option.startsOn.getTime() !== option.endsOn.getTime();
}

function describeSpan(option: { startsOn: Date; endsOn: Date }): string {
  return `${calendarDateFromDbDate(option.startsOn)} to ${calendarDateFromDbDate(option.endsOn)}`;
}

export async function deletePoll(pollId: string): Promise<void> {
  await prisma.poll.delete({ where: { id: pollId } });
}

/**
 * Sorted, de-duplicated, and validated.
 *
 * Duplicate dates are dropped rather than rejected: submitting the same day twice is a slip, not
 * a decision, and splitting a tally across two identical options would understate both of them.
 *
 * Exported for the same reason `isValidRange` is — this module is callable without going through
 * a form, so the guard has to live here and be testable directly.
 */
export function normalizeOptions(
  options: readonly PollOptionInput[],
): PollOptionInput[] {
  const seen = new Set<string>();
  const kept: PollOptionInput[] = [];
  for (const option of options) {
    if (!isValidRange(option.startsOn, option.endsOn)) {
      throw new Error(
        `Option ends (${option.endsOn}) before it starts (${option.startsOn})`,
      );
    }
    const key = `${option.startsOn}/${option.endsOn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(option);
  }
  return kept.sort(
    (a, b) =>
      a.startsOn.localeCompare(b.startsOn) || a.endsOn.localeCompare(b.endsOn),
  );
}
