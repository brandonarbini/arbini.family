import "server-only";

import type { FamilyRole } from "@/generated/prisma/enums";
import { apiError } from "@/lib/api/http";
import { type FamilyUser, getCurrentUser } from "@/lib/auth-helpers";

/**
 * Who is asking, for a JSON endpoint.
 *
 * Reuses `getCurrentUser()` — it reads `headers()`, which is legal in a route handler, and it is
 * `cache()`d so a handler that asks twice pays once. What it must *not* reuse is `requireAuth()`
 * or `requireProfile()`: both `redirect()`, and a 307 to `/signin` is the wrong answer to a fetch.
 * The client would follow it, receive an HTML page with a 200, and report a parse error instead of
 * "you are signed out" — which is a genuinely confusing way to learn a session expired.
 *
 * Returns a discriminated result rather than throwing, so the handler stays a straight line:
 *
 *   const actor = await requireProfileActor();
 *   if (!actor.ok) return actor.response;
 */
export type ProfileActor = FamilyUser & { profileId: string; role: FamilyRole };

export type ActorResult =
  { ok: true; actor: ProfileActor } | { ok: false; response: Response };

export async function requireProfileActor(): Promise<ActorResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: apiError("unauthenticated", "Sign in to see the board."),
    };
  }

  // A signed-in account without a profile is a seeding mistake, not a state to render. The web
  // throws here; an API answers, because a 500 with no explanation is worse than a 403 that names
  // the cause — and unlike the web, whoever sees this is holding a phone, not a server log.
  if (!user.profileId || !user.role) {
    return {
      ok: false,
      response: apiError(
        "forbidden",
        "This account has no family profile yet.",
      ),
    };
  }

  return {
    ok: true,
    actor: { ...user, profileId: user.profileId, role: user.role },
  };
}
