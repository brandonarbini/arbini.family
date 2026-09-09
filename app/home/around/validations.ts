import { z } from "zod";
import {
  daysSchema,
  noteSchema,
  presenceStateSchema,
} from "@/lib/presence/input";

/**
 * Input schemas for the Around strip.
 *
 * A neutral module — no `"use server"`, no `"use client"` — so the action validates against
 * exactly the schema the form was built from. Two copies of these rules would be free to
 * disagree, and the disagreement would surface as a form that accepts something the server then
 * rejects with no field to attach the error to.
 *
 * This file owns only the *`FormData` shaping*. The rules themselves live in
 * `lib/presence/input.ts`, shared with the JSON schema the app posts against.
 */

/**
 * Absent and blank both mean "no note".
 *
 * `undefined` is not a theoretical case: the note field is not rendered at all when the toggle is
 * set to "not saying", because there is nothing to annotate about a day you are taking back. The
 * form then submits no `note` key, `formData.get` returns null, and without this the schema
 * rejected the whole submission with "expected string, received undefined" — an error with no
 * field to attach it to, on the one path that has no field.
 */
const optionalNote = z.preprocess(
  (value) =>
    value === undefined || (typeof value === "string" && value.trim() === "")
      ? null
      : value,
  noteSchema,
);

/**
 * `state` arrives as `""` when the toggle is set to "not saying", and that means unsaid rather
 * than invalid — the same convention the API uses with a null `state`. Clearing is not a third
 * state: it is the removal of a statement, and the strip has to be able to get back to it.
 *
 * `days` arrives as repeated `day` fields, which is how a set of checkboxes submits. `getAll`
 * hands back an array even for one, so there is no single-value case to special-case.
 */
export const presenceFormSchema = z.object({
  profileId: z.uuid("Choose who this is for"),
  state: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    presenceStateSchema.nullable(),
  ),
  days: daysSchema,
  note: optionalNote,
});

export type PresenceFormInput = z.infer<typeof presenceFormSchema>;

/** What every action on this route returns. Errors are values, never thrown — see `actions.ts`. */
export type ActionResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };
