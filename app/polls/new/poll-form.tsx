"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { startPoll } from "@/app/polls/actions";
import { MAX_OPTIONS } from "@/app/polls/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCalendarDays,
  differenceInCalendarDays,
  formatCalendarDate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Starting a poll, in about fifteen seconds.
 *
 * That budget is the whole design constraint. This gets used weekly, and anything that takes a
 * minute gets used once — so the common case is a title and a few taps on a strip of days, with
 * no date pickers, no time fields and no deadline to think about.
 *
 * Days are single-day options (`startsOn === endsOn`, matching `Stay`'s inclusive convention).
 * The range inputs underneath cover the rare holiday-week case with the same shape, and stay
 * folded away so they cost nothing to ignore.
 */

/**
 * Two weeks is the useful default, but the strip stretches to cover anything already selected.
 *
 * "Ask again" shifts last week's dates forward seven days, which can push one past a fixed
 * window — and a selected day the strip does not render is a date that gets submitted while
 * being invisible and impossible to un-select. Growing the strip is what keeps "what is selected"
 * and "what is shown" the same set.
 */
const MIN_STRIP_DAYS = 14;

export function PollForm({
  today,
  places,
  defaultTitle,
  defaultPlaceId,
  defaultDays,
}: {
  today: string;
  places: { id: string; name: string; isHome: boolean }[];
  defaultTitle?: string;
  defaultPlaceId?: string | null;
  /** Pre-selected days, used by "Ask again" to re-run last week's poll shifted forward. */
  defaultDays?: string[];
}) {
  const [state, formAction, pending] = useActionState(startPoll, null);
  const [picked, setPicked] = useState<string[]>(defaultDays ?? []);
  const [ranges, setRanges] = useState<{ startsOn: string; endsOn: string }[]>(
    [],
  );
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const furthest = picked.reduce(
    (max, day) => Math.max(max, differenceInCalendarDays(today, day) + 1),
    MIN_STRIP_DAYS,
  );
  const days = Array.from({ length: furthest }, (_, offset) =>
    addCalendarDays(today, offset),
  );
  const options = [
    ...picked.map((day) => ({ startsOn: day, endsOn: day })),
    ...ranges,
  ].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const full = options.length >= MAX_OPTIONS;

  return (
    <form action={formAction} className="space-y-8">
      <div>
        <Label htmlFor="title">What are you asking about?</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultTitle}
          placeholder="Dinner together"
          maxLength={80}
          required
          autoFocus={!defaultTitle}
          aria-invalid={Boolean(fieldError(state, "title"))}
          className="mt-1.5"
        />
        <FieldError message={fieldError(state, "title")} />
      </div>

      {/*
        Optional, and last in the tab order before the days, because the answer is "home" almost
        every time. It exists because settling writes a stay, and a stay needs somewhere to be —
        a "Beach day?" poll that quietly recorded everyone at home would be worse than useless.
      */}
      {places.length > 1 ? (
        <div>
          <Label htmlFor="placeId">Where?</Label>
          <select
            id="placeId"
            name="placeId"
            defaultValue={defaultPlaceId ?? ""}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Home</option>
            {places
              .filter((place) => !place.isHome)
              .map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
          </select>
        </div>
      ) : null}

      <div>
        <span className="text-sm font-medium">Which days?</span>
        <p className="font-copy mt-0.5 text-sm text-muted-foreground">
          Tap up to {MAX_OPTIONS}. More than that and nobody fills it in.
        </p>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const on = picked.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                // A day already chosen stays tappable so it can be un-chosen; only *new* taps are
                // blocked once the poll is full.
                disabled={!on && full}
                onClick={() =>
                  setPicked((current) =>
                    current.includes(day)
                      ? current.filter((d) => d !== day)
                      : [...current, day],
                  )
                }
                className={cn(
                  "touch-manipulation select-none rounded-md border py-2 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:opacity-30",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-input hover:bg-accent",
                )}
              >
                <span className="block text-[0.625rem] uppercase tracking-wider opacity-70">
                  {formatCalendarDate(day, "EEEEE")}
                </span>
                <span className="block text-sm tabular-nums">
                  {formatCalendarDate(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
        <FieldError message={fieldError(state, "options")} />
      </div>

      {/* Every chosen option, single days and ranges alike, as the fields actually submitted. */}
      {options.map((option) => (
        <input
          key={`${option.startsOn}:${option.endsOn}`}
          type="hidden"
          name="option"
          value={`${option.startsOn}:${option.endsOn}`}
        />
      ))}

      <div>
        {rangeOpen ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="rangeStart">From</Label>
              <Input
                id="rangeStart"
                type="date"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="rangeEnd">To</Label>
              <Input
                id="rangeEnd"
                type="date"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={
                !rangeStart || !rangeEnd || rangeEnd < rangeStart || full
              }
              onClick={() => {
                setRanges((current) => [
                  ...current,
                  { startsOn: rangeStart, endsOn: rangeEnd },
                ]);
                setRangeStart("");
                setRangeEnd("");
                setRangeOpen(false);
              }}
            >
              Add
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            className="font-copy text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            + a longer stretch
          </button>
        )}

        {ranges.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {ranges.map((range, index) => (
              <li
                key={`${range.startsOn}:${range.endsOn}`}
                className="font-copy flex items-center gap-2 text-sm"
              >
                {formatCalendarDate(range.startsOn, "EEE d MMM")} –{" "}
                {formatCalendarDate(range.endsOn, "EEE d MMM")}
                <button
                  type="button"
                  onClick={() =>
                    setRanges((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {state && !state.ok && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || options.length === 0}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Start the poll
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
