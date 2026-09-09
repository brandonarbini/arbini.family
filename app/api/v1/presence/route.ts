import { requireProfileActor } from "@/lib/api/guard";
import { apiError, jsonOk } from "@/lib/api/http";
import { invalidatePresence } from "@/lib/api/invalidate";
import { handleSetPresence, parsePresenceInput } from "@/lib/api/v1/presence";
import { readJsonBody } from "@/lib/api/body";

/**
 * Say what a stretch of days looks like — or take it back.
 *
 * `PUT` rather than `POST`, and one route rather than three, because a run has no identity to
 * address: the request names a person and a span, and afterwards the calendar says what it was
 * told regardless of how many rows it took. That is idempotent, which is what `PUT` means, and it
 * is what makes a double tap on a phone harmless.
 *
 * A null `state` clears the days back to unsaid, the same way a null `kind` clears a poll answer.
 */
export async function PUT(request: Request): Promise<Response> {
  const actor = await requireProfileActor();
  if (!actor.ok) return actor.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = parsePresenceInput(body.value);
  if (!parsed.ok) {
    const { code, message, fieldErrors } = parsed.result;
    return apiError(code, message, fieldErrors);
  }

  const result = await handleSetPresence(actor.actor, parsed.input);
  if (!result.ok)
    return apiError(result.code, result.message, result.fieldErrors);

  invalidatePresence();
  return jsonOk({ ok: true });
}
