import { requireProfileActor } from "@/lib/api/guard";
import { apiError, jsonOk, noContent } from "@/lib/api/http";
import { invalidateStays } from "@/lib/api/invalidate";
import {
  handleDeleteStay,
  handleUpdateStay,
  parseStayInput,
} from "@/lib/api/v1/stays";
import { readJsonBody } from "@/lib/api/body";

/**
 * Change or remove one stay.
 *
 * Both verbs re-read the row's current owner before writing — see the note in `lib/api/v1/stays.ts`
 * — which is why neither of these handlers decides anything itself.
 */
type Context = { params: Promise<{ stayId: string }> };

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const actor = await requireProfileActor();
  if (!actor.ok) return actor.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = parseStayInput(body.value);
  if (!parsed.ok) {
    const { code, message, fieldErrors } = parsed.result;
    return apiError(code, message, fieldErrors);
  }

  const { stayId } = await context.params;
  const result = await handleUpdateStay(actor.actor, stayId, parsed.input);
  if (!result.ok)
    return apiError(result.code, result.message, result.fieldErrors);

  invalidateStays();
  return jsonOk({ id: result.stayId });
}

export async function DELETE(
  _request: Request,
  context: Context,
): Promise<Response> {
  const actor = await requireProfileActor();
  if (!actor.ok) return actor.response;

  const { stayId } = await context.params;
  const result = await handleDeleteStay(actor.actor, stayId);
  if (!result.ok)
    return apiError(result.code, result.message, result.fieldErrors);

  invalidateStays();
  return noContent();
}
