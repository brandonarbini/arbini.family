import "server-only";

import { PollStatus, type ReplyKind } from "@/generated/prisma/enums";
import {
  type CalendarDate,
  addCalendarDays,
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
  /** What the option says. Null when `onDate` is the whole of it. */
  label: string | null;
  /** The day this option is about, when it is about one. */
  onDate: CalendarDate | null;
}

export interface PollInput {
  title: string;
  /** The user who asked. Null only for an ask created outside a session. */
  createdById: string | null;
  options: readonly PollOptionInput[];
  /** The family's today, for working out when this stops asking. */
  today: CalendarDate;
}

/** How long an ask with no dates in it keeps asking. */
export const DEFAULT_OPEN_DAYS = 14;

/**
 * When an ask stops asking.
 *
 * The last day any option is about, or a fortnight out when none of them is about a day.
 *
 * Something has to stop it. "Your turn" on the board is the only thing in this app that nags, and
 * liveness used to fall out of the option dates for free — a poll whose days had passed stopped
 * nagging on its own. Free-text options have no dates to fall out of, so without this an
 * unanswered "what's for dinner" would have sat there forever.
 *
 * Never earlier than the fortnight default, even when every option is a date in the past: an ask
 * that arrives already closed can never be answered, and somebody proposing yesterday by mistake
 * should be able to fix it rather than start again.
 */
export function closingDate(
  options: readonly PollOptionInput[],
  today: CalendarDate,
): CalendarDate {
  const floor = addCalendarDays(today, DEFAULT_OPEN_DAYS);
  const latest = options.reduce<CalendarDate | null>(
    (max, option) =>
      option.onDate && (max === null || option.onDate > max)
        ? option.onDate
        : max,
    null,
  );
  return latest !== null && latest > floor ? latest : floor;
}

/**
 * Create an ask and its options in one transaction.
 *
 * `sortOrder` is assigned from input order rather than from the dates, which is the whole of what
 * changed when options stopped being dates. For a dinner the order is the order somebody thought
 * of them, and for a set of days the form hands them over sorted already — so one rule covers
 * both, and neither needs the ballot to re-derive anything.
 */
export async function createPoll(input: PollInput): Promise<{ id: string }> {
  const options = normalizeOptions(input.options);
  if (options.length === 0) {
    throw new Error("An ask needs at least one option");
  }

  const poll = await prisma.poll.create({
    data: {
      title: input.title.trim(),
      createdById: input.createdById,
      closesOn: dbDateFromCalendarDate(closingDate(options, input.today)),
      options: {
        create: options.map((option, index) => ({
          label: option.label,
          onDate: option.onDate ? dbDateFromCalendarDate(option.onDate) : null,
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
 * Settle an ask on one of its own options.
 *
 * The option is looked up scoped to the poll first. Without that scope a caller could settle one
 * ask on an option belonging to a different one, and the ballot would then render a chosen answer
 * that appears nowhere among its own choices.
 *
 * Returns false rather than throwing on a mismatch, so the action can turn it into a field error;
 * a thrown error reaches the client as an opaque production digest.
 *
 * ## What settling writes
 *
 * An `Event`, but only when the chosen option is about a *day*. The agenda is a list of dates, and
 * a family that has settled on tacos has not settled on a date — filing "What's for dinner Friday?
 * — Tacos" against a day would be putting an answer where the board keeps appointments. Settling
 * such an ask records the answer on the ask itself, which is where anybody would look for it.
 *
 * It used to also write a stay for everybody who said yes, because under the place-based model
 * that was the only thing putting a person anywhere — saying yes to a date *was* the location
 * signal. That coupling is gone, and good riddance: answering an ask should not quietly assert
 * where you will be for two days. Somebody who says yes and means it says so on their strip.
 *
 * The write happens in a transaction that first clears anything a previous settlement left, so
 * settle → reopen → settle elsewhere leaves no ghosts. That idempotence is what makes this safe to
 * press twice, and it is also what makes settling *away* from a dated option take its event back
 * off the board.
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
    select: { id: true, label: true, onDate: true },
  });
  if (!option) return false;

  await prisma.$transaction([
    // Clear a previous settlement before writing this one, or the agenda accumulates every date
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
    ...(option.onDate
      ? [
          prisma.event.create({
            data: {
              title: poll.title,
              date: option.onDate,
              // The option's own words, when it had any beyond the date. "Camping — which
              // weekend?" with "the long one" chosen reads better on the agenda than either half
              // alone.
              note: option.label,
              createdById: poll.createdById,
              pollId,
            },
          }),
        ]
      : []),
  ]);

  return true;
}

/** Reopen a settled ask — somebody's plans changed, which is ordinary. */
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

export async function deletePoll(pollId: string): Promise<void> {
  await prisma.poll.delete({ where: { id: pollId } });
}

/**
 * De-duplicated, trimmed, and in the order they were given.
 *
 * Duplicates are dropped rather than rejected: offering the same thing twice is a slip, not a
 * decision, and splitting a tally across two identical options would understate both. Labels are
 * compared case-insensitively after trimming, because "Tacos" and "tacos" are one choice and a
 * ballot showing both is a ballot that cannot be won.
 *
 * An option with neither a label nor a date says nothing and is dropped — the empty rows a
 * repeating text field leaves behind, rather than an error somebody has to clear.
 *
 * Not sorted. That is the change: sorting by date was right when every option was a date, and is
 * wrong the moment one of them is "tacos".
 *
 * Exported because this module is callable without going through a form, so the guard has to live
 * here and be testable directly.
 */
export function normalizeOptions(
  options: readonly PollOptionInput[],
): PollOptionInput[] {
  const seen = new Set<string>();
  const kept: PollOptionInput[] = [];

  for (const option of options) {
    const label = option.label?.trim() ? option.label.trim() : null;
    if (label === null && option.onDate === null) continue;

    // A date and a label are different kinds of thing, so they cannot collide: "19 Sep" typed as
    // a label is a choice that happens to read like a day, and the family may legitimately have
    // both on one ask.
    const key = option.onDate
      ? `date:${option.onDate}`
      : `label:${label!.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ label, onDate: option.onDate });
  }

  return kept;
}
