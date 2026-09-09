import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";

/**
 * The rules a presence run has to satisfy, whatever shape it arrives in.
 *
 * The two encodings are genuinely different — a form sends `FormData` where an untouched date
 * input is `""` and every value is a string, while the app sends JSON with real nulls — so the
 * *shaping* stays with each caller. What must not differ is the meaning: which dates are real,
 * how long a note may be, and whether a range makes sense.
 *
 * Keeping only the rules here is what stops the phone accepting something the web rejects.
 */

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, "Use a real date (YYYY-MM-DD)");

export const noteSchema = z
  .string()
  .max(200, "Keep it under 200 characters")
  .nullable();

export const presenceStateSchema = z.enum(["AROUND", "AWAY"]);

/**
 * The days being spoken for.
 *
 * A list rather than a first-and-last pair, because the strip is a fortnight of individually
 * tappable cells and a selection is often not contiguous. `lib/presence/ranges.ts` collapses them
 * into runs at the point of writing, so "Friday and Saturday" still ends up as one row.
 *
 * A cap, because the request is a list somebody could send by hand and the strip only ever offers
 * a fortnight. Generous enough for a term abroad picked a day at a time; small enough that no
 * single request can ask the database to write a year.
 */
export const MAX_DAYS = 400;

export const daysSchema = z
  .array(calendarDateSchema)
  .min(1, "Pick at least one day")
  .max(MAX_DAYS, "That's more days than this can set at once");
