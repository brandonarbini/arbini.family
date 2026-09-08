import { z } from "zod";
import {
  calendarDateSchema,
  noteSchema,
  isValidStayRange,
  stayRangeRefinement,
} from "@/lib/board/stay-input";

/**
 * Input schemas for the stay editor.
 *
 * A neutral module — no `"use server"`, no `"use client"` — so the action validates against
 * exactly the schema the form was built from. Two copies of these rules would be free to
 * disagree, and the disagreement would surface as a form that accepts something the server then
 * rejects with no field to attach the error to.
 *
 * This file owns only the *`FormData` shaping*: an untouched date input arrives as `""` and means
 * open-ended, not invalid. The rules themselves live in `lib/board/stay-input.ts`, shared with the
 * JSON schema the app posts against.
 */

const calendarDate = calendarDateSchema;

/**
 * `endsOn` arrives as `""` from an untouched date input, which means "open-ended" rather than
 * "invalid". Normalizing here keeps that HTML detail out of the service, which deals only in
 * `CalendarDate | null`.
 */
const optionalCalendarDate = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  calendarDate.nullable(),
);

const optionalNote = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  noteSchema,
);

export const stayFormSchema = z
  .object({
    // Present when editing, absent when creating. The action uses it to decide which it is doing.
    stayId: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.uuid().nullable(),
    ),
    profileId: z.uuid("Choose who this is for"),
    placeId: z.uuid("Choose a place"),
    startsOn: calendarDate,
    endsOn: optionalCalendarDate,
    note: optionalNote,
  })
  .refine(isValidStayRange, {
    path: [...stayRangeRefinement.path],
    message: stayRangeRefinement.message,
  });

export type StayFormInput = z.infer<typeof stayFormSchema>;

export const deleteStaySchema = z.object({ stayId: z.uuid() });

/** What every action on this route returns. Errors are values, never thrown — see `actions.ts`. */
export type ActionResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };
