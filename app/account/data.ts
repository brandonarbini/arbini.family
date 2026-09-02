import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The passkeys registered to one account.
 *
 * Read straight from the table rather than through Better Auth's API: a passkey row *is* the
 * credential, with no side state to keep in step, and going direct keeps the public key itself
 * from being loaded at all. Only what the list renders is selected.
 */
export async function getPasskeys(userId: string) {
  return prisma.passkey.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, deviceType: true, createdAt: true },
  });
}

export type PasskeysData = Awaited<ReturnType<typeof getPasskeys>>;
