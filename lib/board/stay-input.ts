import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";

/**
 * The rules a stay has to satisfy, whatever shape it arrives in.
 *
 * Promoted out of `app/home/where/validations.ts` when the API gained a second way to submit one.
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

/**
 * `endsOn` is the last day *at* the place, so equal dates are a legitimate one-night stay and the
 * comparison is `>=` rather than `>`. `null` means open-ended.
 */
export function isValidStayRange(input: {
  startsOn: string;
  endsOn: string | null;
}): boolean {
  return input.endsOn === null || input.endsOn >= input.startsOn;
}

export const STAY_RANGE_MESSAGE = "The last day can't be before the first day";

/** The refinement both schemas apply, so the message and the path cannot drift apart. */
export const stayRangeRefinement = {
  path: ["endsOn"] as const,
  message: STAY_RANGE_MESSAGE,
};
