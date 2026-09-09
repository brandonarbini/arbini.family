"use server";

import { updateTag } from "next/cache";
import { type ActionResult, presenceFormSchema } from "@/app/home/validations";
import { requireProfile } from "@/lib/auth-helpers";
import { BOARD_TAGS } from "@/lib/board/cache";
import { canEditProfile } from "@/lib/board/permissions";
import { getPresenceForProfileUncached } from "@/lib/board/data";
import { setPresence } from "@/lib/board/service";

/**
 * The one mutation the board has.
 *
 * The same thin shell every action here is: authenticate, validate, authorize, call the service,
 * then invalidate. Every failure is *returned* rather than thrown — a thrown error reaches the
 * client as an opaque production digest with nothing to attach to a field, which is exactly the
 * feedback a form cannot use.
 *
 * One action rather than the three the stay editor needed, because a day has no identity to
 * address: setting days, extending them and taking them back are all "here is what these days say
 * now". That also closes an authorization hole by construction — the editor had to re-read each
 * row's *current* owner, because a kid could otherwise submit their own `profileId` beside
 * somebody else's `stayId` and have the update reassign the row. With no row id there is no
 * second identity to disagree with.
 */
export async function savePresence(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireProfile("/home");

  const parsed = presenceFormSchema.safeParse({
    profileId: formData.get("profileId") ?? undefined,
    state: formData.get("state") ?? undefined,
    days: formData.getAll("day"),
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

  const { profileId, state, days, note } = parsed.data;

  // Checked against the *submitted* profile, not the actor's own: a kid may say only where they
  // will be, and the profile id travels in the form where anyone could change it.
  if (!canEditProfile(actor, profileId)) {
    return { ok: false, formError: "That's not yours to change." };
  }

  // Uncached, unlike everything the page renders from. `setDays` computes its deletes from
  // these rows, so a snapshot a few seconds old would delete rows that have already moved.
  const existing = await getPresenceForProfileUncached(profileId);
  await setPresence(existing, { profileId, dates: days, state, note });

  // `updateTag` rather than `revalidateTag`: this is a Server Action, and updateTag gives
  // read-your-own-writes — the very next render sees the painted days instead of a stale entry
  // being refreshed in the background while the user stares at the cell they just tapped.
  updateTag(BOARD_TAGS.presence);
  return { ok: true };
}
