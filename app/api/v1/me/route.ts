import { requireProfileActor } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/http";
import { toMeDto } from "@/lib/api/v1/serialize";

/**
 * Who is signed in.
 *
 * Small, but it earns its place: it is the one endpoint that answers "is this stored session still
 * good?" without asking for anything else. The app holds a cookie in the keychain for ninety days,
 * and a cookie can be revoked, expire, or belong to an account whose profile has since gone —
 * cases indistinguishable from a healthy session until something asks.
 *
 * It also carries `role`, which is what the client uses to decide whether to offer editing
 * somebody else's stay. That decision is re-made on the server for every write; this is only so
 * the app can avoid showing a control it knows will be refused.
 */
export async function GET(): Promise<Response> {
  const result = await requireProfileActor();
  if (!result.ok) return result.response;

  return jsonOk(toMeDto(result.actor));
}
