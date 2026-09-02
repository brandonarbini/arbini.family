import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";

/**
 * Input schemas for the stay editor.
 *
 * A neutral module — no `"use server"`, no `"use client"` — so the action validates against
 * exactly the schema the form was built from. Two copies of these rules would be free to
 * disagree, and the disagreement would surface as a form that accepts something the server then
 * rejects with no field to attach the error to.
 */

const calendarDate = z
  .string()
  .refine(isCalendarDate, "Use a real date (YYYY-MM-DD)");

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
  z.string().max(200, "Keep it under 200 characters").nullable(),
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
  .refine((data) => data.endsOn === null || data.endsOn >= data.startsOn, {
    path: ["endsOn"],
    // `endsOn` is the last day *at* the place, so equal dates are a legitimate one-night stay and
    // the comparison is `>=` rather than `>`.
    message: "The last day can't be before the first day",
  });

export type StayFormInput = z.infer<typeof stayFormSchema>;

export const deleteStaySchema = z.object({ stayId: z.uuid() });

/** What every action on this route returns. Errors are values, never thrown — see `actions.ts`. */
export type ActionResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };
