"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  deleteStaySchema,
  stayFormSchema,
} from "@/app/home/where/validations";
import { requireProfile } from "@/lib/auth-helpers";
import { canEditProfile } from "@/lib/board/permissions";
import { getStayOwnerProfileId } from "@/lib/board/data";
import { createStay, deleteStay, updateStay } from "@/lib/board/service";

/**
 * Mutations for the stay editor.
 *
 * Each one is the same thin shell: authenticate, validate, authorize, call the service, then
 * invalidate. Every failure is *returned* rather than thrown — a thrown error reaches the client
 * as an opaque production digest with nothing to attach to a field, which is exactly the feedback
 * a form cannot use.
 */

export async function saveStay(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireProfile("/home/where");

  const parsed = stayFormSchema.safeParse({
    stayId: formData.get("stayId") ?? undefined,
    profileId: formData.get("profileId") ?? undefined,
    placeId: formData.get("placeId") ?? undefined,
    startsOn: formData.get("startsOn") ?? undefined,
    endsOn: formData.get("endsOn") ?? undefined,
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const { stayId, profileId, placeId, startsOn, endsOn, note } = parsed.data;

  // Checked against the *submitted* profile, not the actor's own: a kid may edit only their own
  // stays, and the profile id travels in the form where anyone could change it.
  if (!canEditProfile(actor, profileId)) {
    return { ok: false, formError: "That's not yours to change." };
  }

  if (stayId) {
    // Re-checked against the row's current owner. Without this, a kid could edit a parent's stay
    // by submitting their own `profileId` alongside someone else's `stayId` — the first check
    // would pass, and the update would reassign the row.
    const owner = await getStayOwnerProfileId(stayId);
    if (!owner) return { ok: false, formError: "That stay no longer exists." };
    if (!canEditProfile(actor, owner)) {
      return { ok: false, formError: "That's not yours to change." };
    }
    await updateStay(stayId, { profileId, placeId, startsOn, endsOn, note });
  } else {
    await createStay({ profileId, placeId, startsOn, endsOn, note });
  }

  // No cache tags to invalidate — this project has not adopted Cache Components, and the board
  // renders dynamically because it reads the session. `revalidatePath` still clears the client
  // router cache, so navigating back to the board shows the change rather than the previous
  // render.
  revalidatePath("/home");
  revalidatePath("/home/where");
  return { ok: true };
}

export async function removeStay(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireProfile("/home/where");

  const parsed = deleteStaySchema.safeParse({
    stayId: formData.get("stayId") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, formError: "That stay no longer exists." };
  }

  const owner = await getStayOwnerProfileId(parsed.data.stayId);
  if (!owner) return { ok: false, formError: "That stay no longer exists." };
  if (!canEditProfile(actor, owner)) {
    return { ok: false, formError: "That's not yours to change." };
  }

  await deleteStay(parsed.data.stayId);
  revalidatePath("/home");
  revalidatePath("/home/where");
  return { ok: true };
}
