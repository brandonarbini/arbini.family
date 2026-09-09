import { z } from "zod";
import { isCalendarDate } from "@/lib/dates";

/**
 * Input schemas for asks.
 *
 * Shared by both routes rather than kept route-private: `/polls/new` creates and `/polls/[id]`
 * answers, but the "Ask again" button on the ballot submits a *creation*, so the create schema is
 * read from both directories. A neutral module — no `"use server"`, no `"use client"` — so the
 * action validates against exactly the schema the form was built from.
 */

/** More than this and the ballot is a grid, which nobody fills in. */
export const MAX_OPTIONS = 6;

/** Long enough for "the long weekend in October", short enough to read on one line of a ballot. */
export const MAX_OPTION_LABEL = 60;

/**
 * One option, encoded as `label` or `@date` in a single form field.
 *
 * One field per option rather than paired `label[]`/`onDate[]` arrays, because `FormData` gives no
 * guarantee that two same-named lists interleave — a dropped value in one would silently pair
 * every subsequent label with the wrong date. The same reason the date pair was one field before.
 *
 * A leading `@` marks a date, and is not an escape anybody has to think about: the two ways of
 * adding an option are separate controls, and only the day strip ever writes one.
 */
const optionField = z.string().transform((value, ctx) => {
  if (value.startsWith("@")) {
    const onDate = value.slice(1);
    if (!isCalendarDate(onDate)) {
      ctx.addIssue({ code: "custom", message: "That isn't a real date" });
      return z.NEVER;
    }
    return { label: null, onDate };
  }

  const label = value.trim();
  if (label.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "A choice needs something in it",
    });
    return z.NEVER;
  }
  if (label.length > MAX_OPTION_LABEL) {
    ctx.addIssue({
      code: "custom",
      message: "Keep each choice short",
    });
    return z.NEVER;
  }
  return { label, onDate: null };
});

export const createPollSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Type the question")
    .max(80, "Keep it under 80 characters"),
  options: z
    .array(optionField)
    .min(1, "Give people something to choose from")
    .max(MAX_OPTIONS, `Six choices at most`),
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

/** What every ask action returns. Errors are values, never thrown — see `actions.ts`. */
export type ActionResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string[]> };
