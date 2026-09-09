"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { savePresence } from "@/app/home/around/actions";
import type { ActionResult } from "@/app/home/around/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PresenceState, projectDays } from "@/lib/presence/derive";
import { formatCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * One cell. Derived from `projectDays` rather than declared, so the shape the page computes and
 * the shape this draws cannot drift — and so the *function* stays out of this file: a helper
 * exported from a `"use client"` module and called by a Server Component is a runtime error, not
 * a type error. The import above is `import type`, which is erased, so nothing crosses at runtime.
 */
export type StripDay = ReturnType<typeof projectDays>[number];

/** The three things a day can be. `null` is unsaid, which is the absence of the other two. */
type Setting = PresenceState | null;

/**
 * Saying where you'll be, in about five seconds.
 *
 * That budget is the whole design constraint, and it is what the stay editor this replaced could
 * not meet: recording an ordinary day there meant a place, a first day, a last day and a note —
 * four decisions to answer a question nobody asked. Nobody ever did, so the board sat at five
 * rows of "not recorded" and the countdown never fired.
 *
 * Here: pick which of three things you are saying, tap the days, save. Days are tapped one at a
 * time rather than as a first-and-last span. A span is fewer taps in the best case and a puzzle in
 * every other one — there are only fourteen cells, and "Friday, Saturday and the Tuesday after"
 * is a perfectly ordinary week that a span cannot express at all.
 *
 * There is deliberately **no** "I'm around for the next two weeks" button. One tap asserting
 * fourteen facts is thirteen the person never considered — structurally what
 * `Profile.defaultPlaceId` did before `cb4bf66` deleted it, with a tap ceremony in front — and
 * with everyone marked around by default the countdown would fire every day, which is the same
 * dead headline reached from the other direction. Density without freshness is worse than
 * sparsity.
 */
export function Strip({
  profileId,
  name,
  days,
  isSelf,
}: {
  profileId: string;
  /** Whose strip this is, for the copy. A parent fills these in for the kids. */
  name: string;
  days: StripDay[];
  /** Drives the pronouns: "I'll be there" for your own strip, "Macy will" for anybody else's. */
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(savePresence, null);

  const [picked, setPicked] = useState<string[]>([]);
  const [setting, setSetting] = useState<Setting>("AROUND");

  // Remounts the note field on success, which is what clears it — an uncontrolled input keeps
  // whatever was typed otherwise, and the next entry starts pre-filled with the last one's reason.
  const [generation, setGeneration] = useState(0);
  const [lastHandled, setLastHandled] = useState<ActionResult | null>(null);
  if (state?.ok && state !== lastHandled) {
    setLastHandled(state);
    setGeneration((value) => value + 1);
    setPicked([]);
  }

  const first = name.split(" ")[0];

  return (
    <form key={generation} action={formAction}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="state" value={setting ?? ""} />
      {picked.map((day) => (
        <input key={day} type="hidden" name="day" value={day} />
      ))}

      {/*
        The toggle sits above the calendar because it decides what a tap *means*, and a control
        that changes the meaning of the next thing you touch belongs before it. Picked days render
        in whatever it is set to, so the answer is visible before it is saved.
      */}
      <Toggle
        value={setting}
        onChange={setSetting}
        isSelf={isSelf}
        name={first}
      />

      {/* Seven to a row, so a column is a weekday and two rows are a fortnight. */}
      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((day) => (
          <Cell
            key={day.date}
            day={day}
            picked={picked.includes(day.date)}
            setting={setting}
            onToggle={() =>
              setPicked((current) =>
                current.includes(day.date)
                  ? current.filter((d) => d !== day.date)
                  : [...current, day.date],
              )
            }
          />
        ))}
      </div>

      {picked.length === 0 ? (
        <p className="font-copy mt-4 text-base text-muted-foreground">
          Tap the days you want to set.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {setting !== null ? (
            <div className="space-y-1.5">
              <Label htmlFor={`note-${profileId}`}>
                Note{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id={`note-${profileId}`}
                name="note"
                maxLength={200}
                // Deliberately not an example. "Vanguard, work trip, back late" read as something
                // already filled in, which is the one thing a placeholder must never do.
                placeholder="Add a note"
                className="placeholder:text-muted-foreground/50"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {describeSave(setting, picked.length, isSelf, first)}
            </Button>
            <button
              type="button"
              onClick={() => setPicked([])}
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {state?.ok === false ? (
        <p className="mt-3 text-sm text-destructive">
          {state.formError ??
            Object.values(state.fieldErrors ?? {})[0]?.[0] ??
            "That didn't save."}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Three states, one control.
 *
 * A segmented toggle rather than three submit buttons: the buttons made you choose the answer and
 * commit to it in the same press, so there was no moment where the screen showed what you were
 * about to say. Here the choice is a mode, the picked days redraw in it, and saving is a separate
 * and unsurprising act.
 *
 * "Nothing" is a real option rather than a hidden reset. An unsaid day is the absence of a
 * statement, and taking one back has to be as reachable as making one.
 */
function Toggle({
  value,
  onChange,
  isSelf,
  name,
}: {
  value: Setting;
  onChange: (next: Setting) => void;
  isSelf: boolean;
  name: string;
}) {
  const options: { setting: Setting; label: string }[] = [
    { setting: "AROUND", label: isSelf ? "I'll be there" : `${name} will` },
    { setting: "AWAY", label: isSelf ? "I won't" : `${name} won't` },
    { setting: null, label: "Not saying" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={
        isSelf ? "What you're setting" : `What you're setting for ${name}`
      }
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const on = option.setting === value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.setting)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-input text-muted-foreground hover:bg-accent",
            )}
          >
            {/* The same three marks the calendar uses, so the toggle reads as a key to it. */}
            <span
              className={cn(
                "size-3 shrink-0 rounded-full border",
                option.setting === "AROUND" &&
                  (on
                    ? "border-background bg-background"
                    : "border-foreground bg-foreground"),
                option.setting === "AWAY" &&
                  (on ? "border-background" : "border-foreground"),
                option.setting === null && "border-dashed border-current",
              )}
              aria-hidden
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One day, as a circle.
 *
 * Three appearances for three facts, and the third is the one worth protecting: filled is around,
 * outlined is away, and *empty and dashed* is unsaid — a gap in the paper rather than a third kind
 * of mark. Drawing unsaid as anything positive would make the board's silence look like an answer.
 *
 * A picked day is drawn in whatever the toggle is set to, not in what it currently says, so the
 * calendar previews the change rather than describing the past.
 */
function Cell({
  day,
  picked,
  setting,
  onToggle,
}: {
  day: StripDay;
  picked: boolean;
  setting: Setting;
  onToggle: () => void;
}) {
  const shown = picked ? setting : day.state;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      aria-label={`${formatCalendarDate(day.date, "EEEE d MMMM")} — ${label(day.state)}`}
      title={day.note ?? undefined}
      className="group flex flex-col items-center gap-1 focus-visible:outline-none"
    >
      <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {formatCalendarDate(day.date, "EEEEE")}
      </span>
      <span
        className={cn(
          "flex aspect-square w-full max-w-11 items-center justify-center rounded-full border text-sm tabular-nums transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
          shown === "AROUND" &&
            "border-foreground bg-foreground text-background",
          shown === "AWAY" && "border-foreground text-foreground",
          shown === null && "border-dashed border-input text-muted-foreground",
          // The ring is the only thing that says "picked", because the fill already says what it
          // is about to become. Without it, deselecting a day you had just set would look like
          // nothing happened.
          picked && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        {formatCalendarDate(day.date, "d")}
      </span>
    </button>
  );
}

function label(state: PresenceState | null): string {
  return state === "AROUND"
    ? "will be there"
    : state === "AWAY"
      ? "won't be there"
      : "nothing said";
}

/** Says what the button is about to do, in the number of days it is about to do it to. */
function describeSave(
  setting: Setting,
  count: number,
  isSelf: boolean,
  name: string,
): string {
  const days = count === 1 ? "1 day" : `${count} days`;
  if (setting === null) return `Clear ${days}`;
  const who = isSelf ? "" : ` for ${name}`;
  return setting === "AROUND"
    ? `Save ${days} as there${who}`
    : `Save ${days} as away${who}`;
}
