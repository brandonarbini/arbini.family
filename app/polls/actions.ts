"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import {
  type ActionResult,
  createPollSchema,
  deletePollSchema,
  replySchema,
  settlePollSchema,
} from "@/app/polls/validations";
import { requireProfile } from "@/lib/auth-helpers";
import { todayInFamilyTz } from "@/lib/dates";
import { BOARD_TAGS } from "@/lib/board/cache";
import { getPollCreatorUserId } from "@/lib/board/data";
import { canManagePoll, canReplyAsProfile } from "@/lib/board/permissions";
import {
  clearReply,
  createPoll,
  deletePoll,
  reopenPoll,
  replyToPoll,
  settlePoll,
} from "@/lib/board/service";

/**
 * Mutations for asks.
 *
 * The same thin shell as the Around strip: authenticate, validate, authorize, call the service,
 * invalidate. Failures are *returned* rather than thrown, because a thrown error reaches the
 * client as an opaque production digest with nothing to attach to a field.
 *
 * Note what is missing: there is no permission check on creating. Anyone with a profile may start
 * a poll, and `requireProfile` is the whole gate. A poll only one person can start is a poll that
 * only gets started when that person thinks of it.
 */

export async function startPoll(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireProfile("/polls/new");

  const parsed = createPollSchema.safeParse({
    title: formData.get("title") ?? undefined,
    options: formData.getAll("option"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const poll = await createPoll({
    title: parsed.data.title,
    createdById: actor.id,
    options: parsed.data.options,
    // Read here rather than in the service: `closingDate` keys off it, and a clock consulted
    // inside a write is a clock no test can move.
    today: todayInFamilyTz(),
  });

  updateTag(BOARD_TAGS.polls);
  // Straight to the ballot, because the next thing anybody does after asking is copy the link.
  redirect(`/polls/${poll.id}`);
}

export async function answer(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireProfile("/polls");

  const parsed = replySchema.safeParse({
    optionId: formData.get("optionId") ?? undefined,
    profileId: formData.get("profileId") ?? undefined,
    kind: formData.get("kind") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, formError: "That answer didn't go through." };
  }

  const { optionId, profileId, kind } = parsed.data;

  // Checked against the *submitted* profile, which travels in a form field anyone could change.
  // Stricter than the Around strip on purpose: a parent may paint a kid's days, but nobody
  // answers a poll in somebody else's voice.
  if (!canReplyAsProfile(actor, profileId)) {
    return { ok: false, formError: "Only you can answer for you." };
  }

  if (kind === "") {
    await clearReply(optionId, profileId);
  } else {
    await replyToPoll(optionId, profileId, kind);
  }

  updateTag(BOARD_TAGS.polls);
  return { ok: true };
}

export async function decide(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireProfile("/polls");

  const parsed = settlePollSchema.safeParse({
    pollId: formData.get("pollId") ?? undefined,
    optionId: formData.get("optionId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, formError: "That poll no longer exists." };
  }

  // Read fresh rather than from the cached poll: this is an authorization input, and a cached
  // answer would keep naming whoever created it when the entry was written.
  const poll = await getPollCreatorUserId(parsed.data.pollId);
  if (!poll) return { ok: false, formError: "That poll no longer exists." };
  if (!canManagePoll(actor, poll.createdById)) {
    return { ok: false, formError: "Only whoever asked can settle this." };
  }

  if (parsed.data.optionId === "") {
    await reopenPoll(parsed.data.pollId);
  } else {
    const settled = await settlePoll(parsed.data.pollId, parsed.data.optionId);
    if (!settled) {
      return { ok: false, formError: "That date isn't one of the choices." };
    }
  }

  // Settling writes an event, and reopening takes it back out. Invalidating only the poll tag
  // would leave the agenda showing a date the family has since un-agreed on.
  invalidateBoard();
  return { ok: true };
}

/**
 * Every tag a settlement touches. Named once so a new write cannot forget one of them.
 *
 * `presence` is deliberately absent. Settling used to write a stay per yes, so it had to be here;
 * it no longer writes anything about where anybody will be, and busting the presence tag would be
 * a claim that it might.
 */
function invalidateBoard(): void {
  updateTag(BOARD_TAGS.polls);
  updateTag(BOARD_TAGS.events);
}

export async function removePoll(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireProfile("/polls");

  const parsed = deletePollSchema.safeParse({
    pollId: formData.get("pollId") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, formError: "That poll no longer exists." };
  }

  const poll = await getPollCreatorUserId(parsed.data.pollId);
  if (!poll) return { ok: false, formError: "That poll no longer exists." };
  if (!canManagePoll(actor, poll.createdById)) {
    return { ok: false, formError: "Only whoever asked can delete this." };
  }

  // Cascade takes the settled event with the poll, so the agenda has to be told as well.
  await deletePoll(parsed.data.pollId);
  invalidateBoard();
  redirect("/polls");
}
