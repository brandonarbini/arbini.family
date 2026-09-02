import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FamilyRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import {
  DEFAULT_SIGNED_IN_PATH,
  PATHNAME_HEADER,
  buildSignInUrl,
} from "@/lib/auth-redirect";
import { prisma } from "@/lib/prisma";

/**
 * Server-side session reads.
 *
 * `readSession` is the `cache()`d unit rather than `requireAuth`, so a layout, its page, and a
 * nested component share one session lookup even when they call different helpers with different
 * arguments. React's `cache()` keys on arguments — caching `requireAuth(returnTo)` directly would
 * re-read the session for every distinct `returnTo` and quietly undo the point of caching it.
 */

export interface FamilyUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** The profile row. Absent only for a user seeded without one, which the seed does not do. */
  profileId: string | null;
  role: FamilyRole | null;
}

const readSession = cache(async (): Promise<FamilyUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, role: true },
  });

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    profileId: profile?.id ?? null,
    role: profile?.role ?? null,
  };
});

/** The signed-in user, or null. Use where signed-out is a legitimate state to render. */
export async function getCurrentUser(): Promise<FamilyUser | null> {
  return readSession();
}

/**
 * The signed-in user, or a redirect to sign-in that returns here afterwards.
 *
 * Redirects rather than 404s. The middleware normally catches a signed-out request first, but a
 * cookie that expired between the edge check and the render would otherwise surface as a
 * confusing "not found" on a page the user is perfectly entitled to see.
 *
 * The return path comes from the header the middleware stamped, so someone bounced off
 * /home/where lands back on /home/where rather than the board root.
 */
export async function requireAuth(
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): Promise<FamilyUser> {
  const user = await readSession();
  if (!user) {
    const stamped = (await headers()).get(PATHNAME_HEADER);
    redirect(buildSignInUrl(stamped ?? fallback));
  }
  return user;
}

/**
 * The signed-in user, guaranteed to have a profile.
 *
 * Every board surface needs one: a stay belongs to a profile, not to a user. A signed-in account
 * without a profile is a seeding mistake rather than a state worth rendering an empty page for,
 * so this fails loudly instead of returning null and letting the board render as though the
 * person simply had nothing planned.
 */
export async function requireProfile(
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): Promise<FamilyUser & { profileId: string; role: FamilyRole }> {
  const user = await requireAuth(fallback);
  if (!user.profileId || !user.role) {
    throw new Error(
      `Signed-in user ${user.id} has no family profile. Run \`pnpm db:seed\` or add one.`,
    );
  }
  return { ...user, profileId: user.profileId, role: user.role };
}
