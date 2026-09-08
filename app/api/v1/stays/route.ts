import { requireProfileActor } from "@/lib/api/guard";
import { apiError, jsonOk } from "@/lib/api/http";
import { invalidateStays } from "@/lib/api/invalidate";
import { handleCreateStay, parseStayInput } from "@/lib/api/v1/stays";
import { readJsonBody } from "@/lib/api/body";

/** Record a new stay. */
export async function POST(request: Request): Promise<Response> {
  const actor = await requireProfileActor();
  if (!actor.ok) return actor.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = parseStayInput(body.value);
  if (!parsed.ok) {
    const { code, message, fieldErrors } = parsed.result;
    return apiError(code, message, fieldErrors);
  }

  const result = await handleCreateStay(actor.actor, parsed.input);
  if (!result.ok)
    return apiError(result.code, result.message, result.fieldErrors);

  invalidateStays();
  return jsonOk({ id: result.stayId });
}
