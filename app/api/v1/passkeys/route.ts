import { requireUserActor } from "@/lib/api/guard";
import { apiError, jsonOk } from "@/lib/api/http";
import { toPasskeyDto } from "@/lib/api/v1/serialize";
import { getPasskeys } from "@/lib/passkeys/data";

/**
 * The passkeys on this account.
 *
 * `requireUserActor` rather than `requireProfileActor`: this is the one v1 endpoint that is about
 * the account and not the family, and an account whose profile row is missing still owns its
 * credentials — refusing to list them would be answering a question nobody asked.
 *
 * Read-only. Renaming and removing still go through Better Auth's own `/api/auth/passkey/*`
 * endpoints, which already check that the row belongs to the caller; there is nothing this layer
 * would add to a write except a second place for that check to drift.
 */
export async function GET(): Promise<Response> {
  const result = await requireUserActor();
  if (!result.ok) return result.response;

  try {
    const passkeys = await getPasskeys(result.actor.id);
    return jsonOk(passkeys.map(toPasskeyDto));
  } catch (error) {
    console.error("[api/v1/passkeys] failed to load passkeys", error);
    return apiError("internal", "Your passkeys could not be loaded.");
  }
}
