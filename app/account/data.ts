import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * The passkeys registered to one account.
 *
 * Read straight from the table rather than through Better Auth's API: a passkey row *is* the
 * credential, with no side state to keep in step, and going direct keeps the public key itself
 * from being loaded at all. Only what the list renders is selected.
 *
 * The tag is route-private — it lives here rather than in `/lib` because only this directory
 * reads it and only this directory's `actions.ts` invalidates it. It is keyed by user, so one
 * person removing a passkey cannot clear another's list.
 */
export const PASSKEY_TAGS = {
  forUser: (userId: string) => `passkeys:${userId}`,
} as const;

export async function getPasskeys(userId: string) {
  "use cache";
  cacheTag(PASSKEY_TAGS.forUser(userId));
  cacheLife("days");

  return prisma.passkey.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, deviceType: true, createdAt: true },
  });
}

export type PasskeysData = Awaited<ReturnType<typeof getPasskeys>>;
