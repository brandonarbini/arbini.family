import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";

/**
 * Input schemas for polls.
 *
 * Shared by both routes rather than kept route-private: `/polls/new` creates and `/polls/[id]`
 * answers, but the "Ask again" button on the ballot submits a *creation*, so the create schema is
 * read from both directories. A neutral module — no `"use server"`, no `"use client"` — so the
 * action validates against exactly the schema the form was built from.
 */

const calendarDate = z
  .string()
  .refine(isCalendarDate, "Use a real date (YYYY-MM-DD)");

/** More than this and the ballot is a grid, which nobody fills in. */
export const MAX_OPTIONS = 6;

/**
 * A date option, encoded as `startsOn:endsOn` in a single form field.
 *
 * One field per option rather than paired `startsOn[]`/`endsOn[]` arrays, because `FormData`
 * gives no guarantee that two same-named lists interleave — a dropped value in one would silently
 * pair every subsequent start with the wrong end.
 */
const optionPair = z.string().transform((value, ctx) => {
  const [startsOn, endsOn] = value.split(":");
  if (!isCalendarDate(startsOn) || !isCalendarDate(endsOn)) {
    ctx.addIssue({ code: "custom", message: "That isn't a real date" });
    return z.NEVER;
  }
  // Inclusive, matching `Stay`: a single day has matching dates, so equal is legitimate.
  if (endsOn < startsOn) {
    ctx.addIssue({
      code: "custom",
      message: "A date can't end before it starts",
    });
    return z.NEVER;
  }
  return { startsOn, endsOn };
});

export const createPollSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give it a name so people know what they're answering")
    .max(80, "Keep it under 80 characters"),
  options: z
    .array(optionPair)
    .min(1, "Pick at least one date")
    .max(MAX_OPTIONS, `Pick at most ${MAX_OPTIONS} dates`),
});

export const replySchema = z.object({
  optionId: z.uuid(),
  profileId: z.uuid(),
  // "" clears an answer, putting somebody back to silent rather than to a no — tapping the button
  // you already chose should undo it.
  kind: z.enum(["YES", "MAYBE", "NO", ""]),
});

export const settlePollSchema = z.object({
  pollId: z.uuid(),
  // "" reopens. Plans change, and a settled poll that cannot be reopened gets replaced by a new
  // poll that loses every answer.
  optionId: z.union([z.uuid(), z.literal("")]),
});

export const deletePollSchema = z.object({ pollId: z.uuid() });

export { calendarDate };

/** What every poll action returns. Errors are values, never thrown — see `actions.ts`. */
export type ActionResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };
