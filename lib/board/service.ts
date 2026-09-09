import "server-only";

import { PollStatus, type ReplyKind } from "@/generated/prisma/enums";
import {
  type CalendarDate,
  calendarDateFromDbDate,
  dbDateFromCalendarDate,
} from "@/lib/dates";
import type { PresenceState } from "@/lib/presence/derive";
import { type Plan, type Run, setDays } from "@/lib/presence/ranges";
import { prisma } from "@/lib/prisma";

/**
 * Write-path logic for the board.
 *
 * Auth-free on purpose: the caller — a Server Action, a script, a future webhook — has already
 * established who is acting and whether they may. Keeping that out of here is what lets these be
 * exercised without route plumbing, and stops the authorization rule from being duplicated in
 * three places that can disagree.
 */

export interface PresenceInput {
  profileId: string;
  /**
   * The days being spoken for. Need not be contiguous — the strip is a fortnight of individually
   * tappable cells, and "Friday, Saturday and the Tuesday after" is one act rather than three.
   */
  dates: readonly CalendarDate[];
  /** `null` clears the days, returning them to unsaid rather than recording an away. */
  state: PresenceState | null;
  note: string | null;
}

/**
 * Say what a set of days looks like.
 *
 * The caller hands in the rows that person already has — read *uncached*, via
 * `getPresenceForProfileUncached`, because this computes deletes against them and a snapshot
 * would delete rows that have already moved.
 *
 * `setDays` decides what the calendar should look like; this only writes it. The delete and the
 * creates go in one transaction, because between them the person has a hole in their calendar and
 * the board would render them as unsaid for however long that lasted.
 */
export async function setPresence(
  existing: readonly Run[],
  input: PresenceInput,
): Promise<void> {
  const plan = setDays(
    existing,
    input.dates,
    input.state,
    // Empty is absent. A whitespace-only note renders as a blank line on the board, and it also
    // stops two otherwise-identical runs from merging.
    input.note?.trim() ? input.note.trim() : null,
  );

  await writePlan(plan, input.profileId);
}

async function writePlan(plan: Plan, profileId: string): Promise<void> {
  if (plan.deleteIds.length === 0 && plan.create.length === 0) return;

  await prisma.$transaction([
    // Scoped to the profile as well as the ids. `setDays` is pure and trusts what it was handed,
    // so a caller that passed somebody else's rows would otherwise delete them; this is the one
    // place that can still refuse.
    prisma.presence.deleteMany({
      where: { id: { in: plan.deleteIds }, profileId },
    }),
    ...plan.create.map((run) =>
      prisma.presence.create({
        data: {
          profileId,
          state: run.state,
          startsOn: dbDateFromCalendarDate(run.startsOn),
          endsOn: run.endsOn ? dbDateFromCalendarDate(run.endsOn) : null,
          note: run.note,
        },
      }),
    ),
  ]);
}

/**
 * `endsOn` is the last day the statement holds, so a same-day value is a legitimate single day
 * rather than an empty range. Enforced in `validations.ts` too, where it can produce a field
 * error; repeated here because this module is callable without going through a form.
 */
export function isValidRange(
  startsOn: CalendarDate,
  endsOn: CalendarDate | null,
): boolean {
  return endsOn === null || endsOn >= startsOn;
}

/**
 * Polls.
 *
 * Same contract as the presence writes above: auth-free, because the caller has already
 * established who is acting and whether they may.
 */

export interface PollOptionInput {
  startsOn: CalendarDate;
  /** Last day of the option, inclusive — matching `Presence`. A single day has matching dates. */
  endsOn: CalendarDate;
}

export interface PollInput {
  title: string;
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
 * Settle a poll on one of its own options, and put the date on the board.
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
 * One `Event`, and nothing else. The whole point of settling is that the date lands on the
 * board's agenda rather than living inside a poll nobody reopens.
 *
 * It used to also write a stay for everybody who said yes, because under the place-based model
 * that was the only thing putting a person anywhere — saying yes to a date *was* the location
 * signal. That coupling is gone, and good riddance: answering a poll should not quietly assert
 * where you will be for two days. Somebody who says yes and means it says so on their strip, and
 * the strip is one tap.
 *
 * The event is written in a transaction that first clears anything a previous settlement left, so
 * settle → reopen → settle elsewhere leaves no ghosts. That idempotence is what makes this safe
 * to press twice.
 */
export async function settlePoll(
  pollId: string,
  optionId: string,
): Promise<boolean> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { title: true, createdById: true },
  });
  if (!poll) return false;

  const option = await prisma.pollOption.findFirst({
    where: { id: optionId, pollId },
    select: { id: true, startsOn: true, endsOn: true },
  });
  if (!option) return false;

  await prisma.$transaction([
    // Clear a previous settlement before writing this one, or the board accumulates every date
    // the family ever considered.
    prisma.event.deleteMany({ where: { pollId } }),
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
  ]);

  return true;
}

/** Reopen a settled poll — somebody's plans changed, which is ordinary. */
export async function reopenPoll(pollId: string): Promise<void> {
  // The agenda has to stop claiming a date the moment the family stops agreeing on one, so the
  // derived event goes back out in the same transaction that reopens the poll.
  await prisma.$transaction([
    prisma.event.deleteMany({ where: { pollId } }),
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
