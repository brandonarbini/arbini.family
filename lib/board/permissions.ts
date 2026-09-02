import { FamilyRole } from "@/generated/prisma/enums";

/**
 * Who may change what.
 *
 * Deliberately its own module, free of `server-only`, Prisma and Better Auth, so the rule can be
 * tested directly. It previously sat in `lib/auth-helpers.ts`, where importing it meant booting
 * the entire auth stack — which is precisely how an authorization rule ends up with no tests.
 */

export interface Actor {
  /**
   * The Better Auth user id — named to match `FamilyUser.id` so a signed-in user satisfies this
   * shape directly. `Poll.createdById` points here, not at the profile.
   */
  id: string;
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

/**
 * Who may answer as a given person: only that person.
 *
 * Deliberately stricter than `canEditProfile`, which lets a parent fix anyone's travel dates. The
 * asymmetry is the point. Editing a stay is administration — a correction to a fact about the
 * world. Answering a poll is a statement of intent in somebody's own voice, and a parent tapping
 * "yes" on a kid's behalf does not record what the kid meant, it records what the parent hopes.
 * A tally built from that is worse than an empty one, because it looks answered.
 *
 * There is deliberately no `canCreatePoll`. Anyone with a profile may start one, and a predicate
 * that always returned true would only be an invitation to close it later.
 */
export function canReplyAsProfile(actor: Actor, profileId: string): boolean {
  if (actor.profileId === null) return false;
  return actor.profileId === profileId;
}

/**
 * Who may settle or delete a poll: whoever asked, or either parent.
 *
 * The parent escalation is housekeeping — polls get abandoned, and somebody has to be able to
 * close one that Macy started and forgot. It is authority over the *poll*, not over the answer,
 * which is why it stops here and does not extend to `canReplyAsProfile`.
 *
 * A poll whose creator has since been removed (`createdById` is null) falls to the parents alone.
 */
export function canManagePoll(
  actor: Actor,
  createdByUserId: string | null,
): boolean {
  if (actor.profileId === null) return false;
  if (actor.role === FamilyRole.PARENT) return true;
  return createdByUserId !== null && actor.id === createdByUserId;
}
