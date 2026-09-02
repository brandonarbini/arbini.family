import { FamilyRole } from "@/generated/prisma/enums";

/**
 * Who may change what.
 *
 * Deliberately its own module, free of `server-only`, Prisma and Better Auth, so the rule can be
 * tested directly. It previously sat in `lib/auth-helpers.ts`, where importing it meant booting
 * the entire auth stack — which is precisely how an authorization rule ends up with no tests.
 */

export interface Actor {
  profileId: string | null;
  role: FamilyRole | null;
}

/**
 * Everyone edits their own stays; parents edit anyone's.
 *
 * The asymmetry is mild on purpose. This is a family, and the expensive failure is a parent unable
 * to correct a kid's travel dates from their phone — not a kid seeing something they shouldn't.
 * Nothing here is secret from the five people who can sign in at all; the allowlist is the real
 * boundary, and this only decides who may *write*.
 *
 * An actor with no profile can edit nothing. That state means a signed-in account that was never
 * seeded, and treating it as "no permissions" rather than as an error is what keeps a half-set-up
 * account from being able to rewrite the board.
 */
export function canEditProfile(actor: Actor, profileId: string): boolean {
  if (actor.role === FamilyRole.PARENT) return true;
  if (actor.profileId === null) return false;
  return actor.profileId === profileId;
}
