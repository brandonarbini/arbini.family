import "server-only";

import { apiError } from "@/lib/api/http";

/**
 * Read a JSON request body, or answer the caller.
 *
 * `request.json()` throws on a malformed or empty body, and an unhandled throw in a route handler
 * becomes a 500 — which tells the client the server is broken when in fact the request was. This
 * turns that into the 400 it is.
 */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError("invalid_input", "Expected a JSON body."),
    };
  }
}
