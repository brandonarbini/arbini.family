import "server-only";

import { z } from "zod";
import type { ApiErrorCode } from "@/lib/api/v1/dto";
import { getStayOwnerProfileId } from "@/lib/board/data";
import type { Actor } from "@/lib/board/permissions";
import { canEditProfile } from "@/lib/board/permissions";
import { createStay, deleteStay, updateStay } from "@/lib/board/service";
import {
  calendarDateSchema,
  isValidStayRange,
  noteSchema,
  stayRangeRefinement,
} from "@/lib/board/stay-input";

/**
 * The decisions behind the stay endpoints, with nothing Next-shaped in them.
 *
 * Separated from the route handlers on purpose: a handler cannot be called from a test, because
 * `headers()` and `revalidateTag()` need a request context that Vitest has no way to supply. Keep
 * the decisions here and the routes become auth → parse → delegate → invalidate → respond, and the
 * part actually worth testing — who may change what — is reachable from `stays.test.ts` against a
 * real database.
 *
 * Every function returns a result rather than throwing, so the route can map a category onto a
 * status without a try/catch around business logic.
 */

/**
 * The JSON body, as the app sends it.
 *
 * Distinct from `stayFormSchema` in `app/home/where/validations.ts`, which shapes `FormData`:
 * there, an untouched date input is `""` and has to be normalised to null. JSON has real nulls, so
 * this schema does no preprocessing — but both are built from the same rules in
 * `lib/board/stay-input.ts`, which is what keeps the phone and the web agreeing on what a valid
 * stay is.
 */
export const stayInputSchema = z
  .object({
    profileId: z.uuid("Choose who this is for"),
    placeId: z.uuid("Choose a place"),
    startsOn: calendarDateSchema,
    endsOn: calendarDateSchema.nullable(),
    note: noteSchema,
  })
  .refine(isValidStayRange, {
    path: [...stayRangeRefinement.path],
    message: stayRangeRefinement.message,
  });

export type StayInput = z.infer<typeof stayInputSchema>;

export type StayFailure = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type StayResult = { ok: true; stayId: string } | StayFailure;

/** The words the web uses, so both clients say the same thing. */
const NOT_YOURS = "That's not yours to change.";
const GONE = "That stay no longer exists.";

export function parseStayInput(
  body: unknown,
): { ok: true; input: StayInput } | { ok: false; result: StayFailure } {
  const parsed = stayInputSchema.safeParse(body);
  if (parsed.success) return { ok: true, input: parsed.data };

  return {
    ok: false,
    result: {
      ok: false,
      code: "invalid_input",
      message: "Check the dates.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    },
  };
}

export async function handleCreateStay(
  actor: Actor,
  input: StayInput,
): Promise<StayResult> {
  // Checked against the *submitted* profile, not the actor's own. A kid may record only their own
  // travel, and `profileId` arrives in the request body where anyone could change it.
  if (!canEditProfile(actor, input.profileId)) {
    return { ok: false, code: "forbidden", message: NOT_YOURS };
  }

  const stay = await createStay(input);
  return { ok: true, stayId: stay.id };
}

export async function handleUpdateStay(
  actor: Actor,
  stayId: string,
  input: StayInput,
): Promise<StayResult> {
  if (!canEditProfile(actor, input.profileId)) {
    return { ok: false, code: "forbidden", message: NOT_YOURS };
  }

  /**
   * The second check, and the one that matters.
   *
   * Without it a kid could edit a parent's stay by sending their *own* `profileId` alongside
   * somebody else's `stayId`: the check above would pass, and the update would quietly reassign
   * the row to them. Authorising the submitted profile says who the stay may belong to *after*
   * the write; only re-reading the row says who it belongs to now.
   */
  const owner = await getStayOwnerProfileId(stayId);
  if (!owner) return { ok: false, code: "not_found", message: GONE };
  if (!canEditProfile(actor, owner)) {
    return { ok: false, code: "forbidden", message: NOT_YOURS };
  }

  await updateStay(stayId, input);
  return { ok: true, stayId };
}

export async function handleDeleteStay(
  actor: Actor,
  stayId: string,
): Promise<StayResult> {
  // No submitted profile to check here, so the row's current owner is the only authority.
  const owner = await getStayOwnerProfileId(stayId);
  if (!owner) return { ok: false, code: "not_found", message: GONE };
  if (!canEditProfile(actor, owner)) {
    return { ok: false, code: "forbidden", message: NOT_YOURS };
  }

  await deleteStay(stayId);
  return { ok: true, stayId };
}
