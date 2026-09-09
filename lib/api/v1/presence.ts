import "server-only";

import { z } from "zod";
import type { ApiErrorCode } from "@/lib/api/v1/dto";
import { getPresenceForProfileUncached } from "@/lib/board/data";
import type { Actor } from "@/lib/board/permissions";
import { canEditProfile } from "@/lib/board/permissions";
import { setPresence } from "@/lib/board/service";
import {
  daysSchema,
  noteSchema,
  presenceStateSchema,
} from "@/lib/presence/input";

/**
 * The decisions behind the presence endpoint, with nothing Next-shaped in them.
 *
 * Separated from the route handler on purpose: a handler cannot be called from a test, because
 * `headers()` and `revalidateTag()` need a request context that Vitest has no way to supply. Keep
 * the decisions here and the route becomes auth → parse → delegate → invalidate → respond, and
 * the part actually worth testing — who may change what — is reachable from `presence.test.ts`
 * against a real database.
 *
 * Every function returns a result rather than throwing, so the route can map a category onto a
 * status without a try/catch around business logic.
 *
 * ## One check, where there used to be two
 *
 * The stay endpoints this replaced had to authorize twice: once against the submitted
 * `profileId`, and again against the row's *current* owner, because otherwise a kid could edit a
 * parent's stay by sending their own profile id alongside somebody else's stay id — the first
 * check would pass and the update would quietly reassign the row.
 *
 * There is no row id here. A run is addressed by whose calendar it is on and which days it
 * covers, so the submitted profile is the only thing that needs checking and there is no second
 * identity for it to disagree with. The hole closed by construction rather than by a guard, which
 * is the better way to close one.
 */

/**
 * The JSON body, as the app sends it.
 *
 * `days` is a list rather than a first-and-last pair. The strip is a fortnight of individually
 * tappable cells, so a selection is often not contiguous — "Friday, Saturday and the Tuesday
 * after" is one act. `lib/presence/ranges.ts` collapses them into runs when it writes, so the
 * storage is still a range and a weekend is still one row.
 *
 * `state: null` clears the days, returning them to unsaid — the same shape as `ReplyInputDto`,
 * where null clears an answer rather than recording a no. Both encode the same idea: the absence
 * of a statement is a state the model has, and the client needs a way back to it.
 *
 * Distinct from the form schema in `app/home/validations.ts`, which shapes `FormData`:
 * there, days arrive as repeated fields and the state as `""` for a clear. JSON has real arrays
 * and real nulls, so this schema does no preprocessing — but both are built from the same rules in
 * `lib/presence/input.ts`, which keeps the phone and the web agreeing.
 */
export const presenceInputSchema = z.object({
  profileId: z.uuid("Choose who this is for"),
  state: presenceStateSchema.nullable(),
  days: daysSchema,
  note: noteSchema,
});

export type PresenceInput = z.infer<typeof presenceInputSchema>;

export type PresenceFailure = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type PresenceResult = { ok: true } | PresenceFailure;

/** The words the web uses, so both clients say the same thing. */
const NOT_YOURS = "That's not yours to change.";

export function parsePresenceInput(
  body: unknown,
): { ok: true; input: PresenceInput } | { ok: false; result: PresenceFailure } {
  const parsed = presenceInputSchema.safeParse(body);
  if (parsed.success) return { ok: true, input: parsed.data };

  return {
    ok: false,
    result: {
      ok: false,
      code: "invalid_input",
      message: "Check the days.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    },
  };
}

/**
 * Set a handful of days, or clear them.
 *
 * The existing rows are read *uncached* and handed to the service, which folds the new days into
 * them. That read has to be fresh: `setDays` computes deletes from what it is shown, so a snapshot
 * a few seconds old would delete rows that have already moved and leave the ones that replaced
 * them overlapping.
 */
export async function handleSetPresence(
  actor: Actor,
  input: PresenceInput,
): Promise<PresenceResult> {
  // Checked against the *submitted* profile, not the actor's own. A kid may say only where they
  // will be, and `profileId` arrives in the request body where anyone could change it.
  if (!canEditProfile(actor, input.profileId)) {
    return { ok: false, code: "forbidden", message: NOT_YOURS };
  }

  const existing = await getPresenceForProfileUncached(input.profileId);

  await setPresence(existing, {
    profileId: input.profileId,
    dates: input.days,
    state: input.state,
    note: input.note,
  });

  return { ok: true };
}
