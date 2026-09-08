import "server-only";

import { z } from "zod";
import { ReplyKind } from "@/generated/prisma/enums";
import type { ApiErrorCode } from "@/lib/api/v1/dto";
import { getPollForOption } from "@/lib/board/data";
import type { Actor } from "@/lib/board/permissions";
import { canReplyAsProfile } from "@/lib/board/permissions";
import { clearReply, replyToPoll } from "@/lib/board/service";

/**
 * The decisions behind the poll endpoints, with nothing Next-shaped in them — the same split as
 * `lib/api/v1/stays.ts`, and for the same reason: a route handler cannot be reached from a test.
 */

/**
 * `null` clears the answer.
 *
 * That is a third state, not a synonym for "no". Someone who answered by accident and takes it
 * back is *silent* again, and the tally counts silence separately — folding the two together
 * would let a retracted answer read as a refusal.
 */
export const replyInputSchema = z.object({
  kind: z.enum(["YES", "MAYBE", "NO"]).nullable(),
});

export type ReplyInput = z.infer<typeof replyInputSchema>;

export type PollFailure = {
  ok: false;
  code: ApiErrorCode;
  message: string;
};

export type PollResult = { ok: true } | PollFailure;

/** The words the web uses, so both clients say the same thing. */
const NOT_YOU = "Only you can answer for you.";
const GONE = "That poll is no longer there.";
const SETTLED = "That poll has already been settled.";

export function parseReplyInput(
  body: unknown,
): { ok: true; input: ReplyInput } | { ok: false; result: PollFailure } {
  const parsed = replyInputSchema.safeParse(body);
  if (parsed.success) return { ok: true, input: parsed.data };

  return {
    ok: false,
    result: {
      ok: false,
      code: "invalid_input",
      message: "That answer didn't go through.",
    },
  };
}

/**
 * Answer one option, on behalf of exactly one person.
 *
 * `canReplyAsProfile` rather than `canEditProfile`, and the difference is the point. A parent may
 * correct a kid's travel dates — that is administration, a fact about the world. Answering a poll
 * is a statement of intent in somebody's own voice, and a parent tapping "yes" for a kid records
 * what the parent hopes rather than what the kid meant. A tally built from that is worse than an
 * empty one, because it looks answered.
 */
export async function handleReply(
  actor: Actor,
  optionId: string,
  profileId: string,
  input: ReplyInput,
): Promise<PollResult> {
  if (!canReplyAsProfile(actor, profileId)) {
    return { ok: false, code: "forbidden", message: NOT_YOU };
  }

  // The option has to belong to a poll that still exists and is still open. Without this, a reply
  // could land on a settled poll and change a tally that has already been acted on — stays and
  // events were written from it.
  //
  // Read uncached, deliberately: this is an authorization input, and `getPolls()` is a cached read
  // that would keep reporting a settled poll as open for as long as its entry lived. It is also
  // what keeps this function callable from a test at all.
  const poll = await getPollForOption(optionId);

  if (!poll) return { ok: false, code: "not_found", message: GONE };
  if (poll.status === "SETTLED") {
    return { ok: false, code: "forbidden", message: SETTLED };
  }

  if (input.kind === null) {
    await clearReply(optionId, profileId);
  } else {
    await replyToPoll(optionId, profileId, ReplyKind[input.kind]);
  }

  return { ok: true };
}
