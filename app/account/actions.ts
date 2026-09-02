"use server";

import {
  type ActionResult,
  deletePasskeySchema,
} from "@/app/account/validations";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * Remove a passkey.
 *
 * The ownership check is expressed as part of the `deleteMany` filter rather than as a `findUnique`
 * followed by a `delete`. That collapses the check and the write into one statement, so there is
 * no window between them in which the row could change hands, and a passkey belonging to someone
 * else simply matches nothing.
 */
export async function removePasskey(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth("/account");

  const parsed = deletePasskeySchema.safeParse({
    passkeyId: formData.get("passkeyId") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, formError: "That passkey no longer exists." };
  }

  const { count } = await prisma.passkey.deleteMany({
    where: { id: parsed.data.passkeyId, userId: user.id },
  });

  if (count === 0) {
    // Same message whether the row was someone else's or never existed — there is no reason to
    // confirm to a caller that a passkey they cannot touch is real.
    return { ok: false, formError: "That passkey no longer exists." };
  }

  return { ok: true };
}
