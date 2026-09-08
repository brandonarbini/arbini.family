import "server-only";

import type { ApiErrorBody, ApiErrorCode } from "@/lib/api/v1/dto";

/**
 * Response helpers for `/api/v1/*`.
 *
 * These deliberately do not mirror `ActionResult`. That type exists because a Server Action has no
 * status channel — a `<form>` needs somewhere to hang a failure, so success and failure both come
 * back as a 200 with a discriminant. HTTP has a status line, and throwing it away is what makes an
 * API tedious to consume: every caller would have to parse the body to learn whether it worked.
 *
 * What is borrowed is the *shape* of a validation failure. `fieldErrors` keeps `ActionResult`'s
 * `Record<string, string[]>` exactly, so a native form can render errors with the same code the
 * web form uses.
 */

/** Maps a failure category onto the status that says the same thing. */
const STATUS_FOR: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  internal: 500,
};

export function jsonOk<T>(body: T): Response {
  return Response.json(body, {
    status: 200,
    // These responses are per-person and short-lived; a shared cache holding one would serve
    // somebody else's board. The client caches deliberately, in React Query.
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): Response {
  const body: ApiErrorBody = {
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
  };
  return Response.json(body, {
    status: STATUS_FOR[code],
    headers: { "Cache-Control": "private, no-store" },
  });
}
