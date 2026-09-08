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

export type UserActorResult =
  { ok: true; actor: FamilyUser } | { ok: false; response: Response };

/**
 * Signed in, and nothing more.
 *
 * For endpoints about the *account* rather than the family: your passkeys are yours whether or not
 * a profile row was ever created for you, and refusing to list them because the board would have
 * nothing to show you is the wrong answer to the wrong question.
 */
export async function requireUserActor(
  // The 401 says what the caller was trying to do, so it can be read on a phone without knowing
  // which endpoint produced it.
  signedOutMessage = "Sign in first.",
): Promise<UserActorResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: apiError("unauthenticated", signedOutMessage),
    };
  }

  return { ok: true, actor: user };
}

export async function requireProfileActor(): Promise<ActorResult> {
  const result = await requireUserActor("Sign in to see the board.");
  if (!result.ok) return result;

  const user = result.actor;

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
