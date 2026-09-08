import { requireProfileActor } from "@/lib/api/guard";
import { apiError, noContent } from "@/lib/api/http";
import { invalidatePolls } from "@/lib/api/invalidate";
import { handleReply, parseReplyInput } from "@/lib/api/v1/polls";
import { readJsonBody } from "@/lib/api/body";

/**
 * Answer one option, as yourself.
 *
 * PUT rather than POST: answering twice is answering once. The reply is upserted on
 * `(optionId, profileId)`, so a double tap on a flaky connection cannot produce two votes.
 *
 * There is no `profileId` in the body. Only you may answer for you, so taking it from the session
 * removes the field an attacker would have edited — and removes the temptation to add a parent
 * override later, which is the one place this app deliberately refuses to have one.
 */
type Context = { params: Promise<{ pollId: string; optionId: string }> };

export async function PUT(
  request: Request,
  context: Context,
): Promise<Response> {
  const actor = await requireProfileActor();
  if (!actor.ok) return actor.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = parseReplyInput(body.value);
  if (!parsed.ok) return apiError(parsed.result.code, parsed.result.message);

  const { optionId } = await context.params;
  const result = await handleReply(
    actor.actor,
    optionId,
    actor.actor.profileId,
    parsed.input,
  );
  if (!result.ok) return apiError(result.code, result.message);

  invalidatePolls();
  return noContent();
}
