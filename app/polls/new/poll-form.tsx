"use client";

import { useActionState, useState } from "react";
import { Loader2, X } from "lucide-react";
import { startPoll } from "@/app/polls/actions";
import { MAX_OPTIONS, MAX_OPTION_LABEL } from "@/app/polls/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCalendarDays, formatCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Asking the family something, in about fifteen seconds.
 *
 * That budget is the whole design constraint. This gets used weekly, and anything that takes a
 * minute gets used once — so the common case is a question and a few options typed straight in.
 *
 * Two ways to add an option, because there are two kinds of question and they want different
 * controls. "What's for dinner?" wants a text field. "Which weekend?" wants a strip of tappable
 * days, which is fewer taps than typing three dates and cannot produce a date that does not exist.
 * An ask may mix them; nothing stops "Friday", "Saturday" and "whenever suits" on one ballot.
 *
 * The days used to be the *only* way, because settling wrote a stay and a stay needs a day. It
 * does not any more, and most of what a family asks each other is not about a day at all.
 */

/** Two weeks of days on offer, which is as far ahead as anybody picks a weekend. */
const STRIP_DAYS = 14;

type Draft = { key: string; label: string | null; onDate: string | null };

export function PollForm({
  today,
  defaultTitle,
  defaultOptions,
}: {
  today: string;
  defaultTitle?: string;
  /** Pre-filled options, used by "Ask again" to carry last week's question forward. */
  defaultOptions?: { label: string | null; onDate: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(startPoll, null);

  const [drafts, setDrafts] = useState<Draft[]>(() =>
    (defaultOptions ?? []).map((option, index) => ({
      key: `seed-${index}`,
      label: option.label,
      onDate: option.onDate,
    })),
  );
  const [typed, setTyped] = useState("");

  const full = drafts.length >= MAX_OPTIONS;
  const days = Array.from({ length: STRIP_DAYS }, (_, offset) =>
    addCalendarDays(today, offset),
  );
  const pickedDates = new Set(
    drafts.map((draft) => draft.onDate).filter(Boolean),
  );

  function addLabel() {
    const label = typed.trim();
    if (!label || full) return;
    setDrafts((current) => [
      ...current,
      { key: `label-${Date.now()}`, label, onDate: null },
    ]);
    setTyped("");
  }

  function toggleDate(date: string) {
    setDrafts((current) =>
      current.some((draft) => draft.onDate === date)
        ? current.filter((draft) => draft.onDate !== date)
        : full
          ? current
          : [...current, { key: `date-${date}`, label: null, onDate: date }],
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <div>
        <Label htmlFor="title">What are you asking?</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultTitle}
          placeholder="What's for dinner Friday?"
          maxLength={80}
          required
          autoFocus={!defaultTitle}
          aria-invalid={Boolean(fieldError(state, "title"))}
          className="mt-1.5 placeholder:text-muted-foreground/50"
        />
        <FieldError message={fieldError(state, "title")} />
      </div>

      <div>
        <span className="text-sm font-medium">The choices</span>
        <p className="font-copy mt-0.5 text-sm text-muted-foreground">
          Up to {MAX_OPTIONS}. More than that and nobody fills it in.
        </p>

        {drafts.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {drafts.map((draft) => (
              <li key={draft.key}>
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((current) =>
                      current.filter((one) => one.key !== draft.key),
                    )
                  }
                  className="font-copy flex items-center gap-2 rounded-md border border-foreground px-3 py-1.5 text-sm"
                >
                  {draft.label ??
                    formatCalendarDate(draft.onDate!, "EEE d MMM")}
                  <X className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="sr-only">Remove</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            // Enter adds an option instead of submitting the form. Submitting on Enter with a
            // half-typed choice still in the box is how you lose the one you were adding.
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addLabel();
            }}
            maxLength={MAX_OPTION_LABEL}
            disabled={full}
            placeholder="Tacos"
            aria-label="Add a choice"
            className="placeholder:text-muted-foreground/50"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addLabel}
            disabled={full || typed.trim().length === 0}
          >
            Add
          </Button>
        </div>
        <FieldError message={fieldError(state, "options")} />

        <p className="font-copy mt-6 text-sm text-muted-foreground">
          Or tap the days you&rsquo;re asking about.
        </p>
        {/* Seven to a row, so a column is a weekday — the same shape as the Around strip. */}
        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day) => {
            const on = pickedDates.has(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                // A day already chosen stays tappable so it can be un-chosen; only *new* taps are
                // blocked once the ask is full.
                disabled={!on && full}
                onClick={() => toggleDate(day)}
                className="group flex flex-col items-center gap-1 focus-visible:outline-none disabled:opacity-30"
              >
                <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  {formatCalendarDate(day, "EEEEE")}
                </span>
                <span
                  className={cn(
                    "flex aspect-square w-full max-w-11 items-center justify-center rounded-full border text-sm tabular-nums transition-colors",
                    "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-dashed border-input text-muted-foreground",
                  )}
                >
                  {formatCalendarDate(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        Every option as the field actually submitted. A leading `@` marks a date — see
        `optionField` in `validations.ts` for why one field carries both.
      */}
      {drafts.map((draft) => (
        <input
          key={draft.key}
          type="hidden"
          name="option"
          value={draft.onDate ? `@${draft.onDate}` : draft.label!}
        />
      ))}

      {state && !state.ok && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || drafts.length === 0}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Ask the family
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-destructive">
      {message}
    </p>
  );
}

function fieldError(
  state: { ok: boolean; fieldErrors?: Record<string, string[]> } | null,
  field: string,
): string | undefined {
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[field]?.[0];
}
