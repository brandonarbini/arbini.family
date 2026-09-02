/**
 * Post-sign-in redirect handling, shared by the edge middleware and the server-side gates.
 *
 * Its own module because `middleware.ts` runs on the edge runtime and cannot import `lib/auth.ts`
 * (which pulls in Prisma), while `lib/auth-helpers.ts` needs the same two values. Keeping them
 * here is what stops the header name from being written as a literal in two places and drifting.
 */

/** The header middleware stamps so the server-side gate can rebuild the caller's actual path. */
export const PATHNAME_HEADER = "x-arbini-pathname";

/** Where a signed-in visitor with no particular destination belongs. */
export const DEFAULT_SIGNED_IN_PATH = "/home";

/**
 * Build the sign-in URL that returns to `returnTo` afterwards.
 *
 * Only same-origin *paths* survive. A `returnTo` of `https://evil.example` would otherwise turn
 * the sign-in page into an open redirect that borrows the family's trust in the domain, and this
 * value ultimately comes from a request header.
 */
export function buildSignInUrl(returnTo: string): string {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe || safe === DEFAULT_SIGNED_IN_PATH) return "/signin";
  return `/signin?redirect=${encodeURIComponent(safe)}`;
}

/**
 * Reduce an untrusted redirect target to a same-origin path, or `null`.
 *
 * Rejects anything not starting with a single `/`. The `//` case matters and is easy to miss:
 * `//evil.example` is a protocol-relative URL that browsers resolve off-origin, so it passes a
 * naive "starts with /" check and still leaves the site.
 */
export function sanitizeReturnTo(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}
