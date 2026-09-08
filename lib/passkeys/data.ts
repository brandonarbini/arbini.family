import "server-only";

import { passkeyLabel } from "@/lib/passkeys/label";
import { prisma } from "@/lib/prisma";

/**
 * Whether the credential can leave the device it was made on. Better Auth writes one of exactly
 * these two strings, from `credentialDeviceType` in the attestation; the column is a plain `String`
 * only because its adapter has no enum for it.
 */
export type PasskeyDeviceType = "singleDevice" | "multiDevice";

/** One passkey, as every surface shows it. */
export interface PasskeySummary {
  id: string;
  label: string;
  deviceType: PasskeyDeviceType;
}

/**
 * The passkeys registered to one account.
 *
 * Shared rather than a route sidecar: `/account` renders this and `GET /api/v1/passkeys` returns
 * it, and the interesting part — what an unnamed credential is called — must not be answered twice.
 * Resolving the label here is what lets the phone render `label` directly without carrying the
 * AAGUID table, and what guarantees the two surfaces agree about a row.
 *
 * Read straight from the table rather than through Better Auth's API: a passkey row *is* the
 * credential, with no side state to keep in step, and going direct keeps the public key itself from
 * being loaded at all. Only what a list renders is selected.
 *
 * Deliberately uncached. Removal and renaming go through our own writes, but registration is
 * handled by Better Auth's route handler; there is no shared write boundary that can invalidate a
 * cache tag after every operation. This is an account-only query over a handful of rows, so reading
 * it fresh is cheaper and more reliable than letting a newly registered credential stay invisible.
 */
export async function getPasskeys(userId: string): Promise<PasskeySummary[]> {
  const passkeys = await prisma.passkey.findMany({
    where: { userId },
    // Oldest first, so a newly added credential appears at the end rather than displacing the list
    // somebody was already reading. `createdAt` is nullable in the schema and is not returned —
    // nothing renders it, and a date on the wire is a promise about a format.
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, aaguid: true, deviceType: true },
  });

  return passkeys.map((passkey) => ({
    id: passkey.id,
    label: passkeyLabel(passkey.name, passkey.aaguid),
    // Narrowed once, here. Anything that is not explicitly single-device is treated as synced,
    // which is the same binary every surface already renders — better that than a third state
    // nothing has copy for.
    deviceType:
      passkey.deviceType === "singleDevice" ? "singleDevice" : "multiDevice",
  }));
}
