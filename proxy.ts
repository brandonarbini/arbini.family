import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PATHNAME_HEADER, buildSignInUrl } from "@/lib/auth-redirect";

/**
 * An optimistic edge gate over the signed-in surfaces.
 *
 * Named `proxy` in `proxy.ts` rather than `middleware`: Next 16 renamed this convention. The old
 * name still runs, but warns on every build.
 *
 * `getSessionCookie` tests only that a session cookie is *present* — never that it is valid, and
 * never touching the database. That is the point: it bounces signed-out visitors without paying
 * for a server render. The real check is `requireAuth()` in lib/auth-helpers.ts, and a forged or
 * expired cookie gets exactly as far as that.
 *
 * The matcher stays narrow deliberately. `/`, `/signin` and `/api/auth/*` must all be reachable
 * signed out, and the magic-link verify endpoint in particular is followed by someone who has no
 * session yet — that is the entire purpose of the link.
 */
export function proxy(request: NextRequest) {
  // Chat crawlers have no family session, but they need this one route to render a useful link
  // preview. Keep the rest of /polls behind the gate so a signed-out ballot request is redirected
  // with its full path instead of falling back to the polls index in the shared layout.
  if (request.nextUrl.pathname.endsWith("/opengraph-image")) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname + request.nextUrl.search;

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(buildSignInUrl(path), request.url));
  }

  // Stamp the caller's full path so requireAuth() can send them back to the deep link they hit
  // rather than the board root. Any client-supplied copy is deleted first, so a route handler
  // reading this header can trust it to mean "middleware set this" and not "a caller asked for
  // this".
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(PATHNAME_HEADER);
  requestHeaders.set(PATHNAME_HEADER, path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/home/:path*", "/account/:path*", "/polls/:path*"],
};
