"use client";

import { useOptimistic, useState, useTransition } from "react";
import { savePresence } from "@/app/home/actions";
import { PersonBadge } from "@/components/person-badge";
import type { Horizon, PresenceState } from "@/lib/presence/derive";
import { formatCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * The fortnight: what everyone has said, and where you say it.
 *
 * This replaced two screens. The board drew a 5×14 grid of what people had said and the Around tab
 * drew the same fourteen days again, in the same three marks, as buttons — one screen was a
 * photograph of the other, and the app's most frequent action ("I'm around this weekend") began
 * with a tab change, a page load and a scroll past four other people's calendars to reach your own.
 *
 * Now the grid is the overview and the strip below it is the editor, and picking a row moves the
 * editor to that person. A parent gets one strip with a row of faces to switch between, rather
 * than five stacked forms.
 *
 * The strip exists at all — rather than making the grid cells themselves tappable — because of the
 * thumb. Fourteen columns on a phone is about twenty points per column, and a target that small
 * cannot be hit reliably. The grid stays a picture; the thing you touch is drawn at the size of a
 * finger.
 */

/** The three things a day can be. `null` is unsaid — the absence of the other two. */
type Setting = PresenceState | null;

export interface FortnightRow {
  profileId: string;
  name: string;
  /** One entry per day in `days`, in order. */
  cells: { state: Setting; note: string | null }[];
  /** How far ahead they have spoken — see `horizonFrom`. */
  horizon: Horizon;
  /** False for a person this viewer may not speak for — a kid looking at a sibling. */
  editable: boolean;
}

/** What a paint replaced, kept just long enough to put it back. */
interface Stroke {
  profileId: string;
  date: string;
  was: { state: Setting; note: string | null };
  now: Setting;
}

export function Fortnight({
  days,
  rows,
  viewerProfileId,
}: {
  days: string[];
  rows: FortnightRow[];
  viewerProfileId: string;
}) {
  const editable = rows.filter((row) => row.editable);

  const [selectedId, setSelectedId] = useState(
    () =>
      editable.find((row) => row.profileId === viewerProfileId)?.profileId ??
      editable[0]?.profileId ??
      null,
  );
  const [mode, setMode] = useState<Setting>("AROUND");
  const [note, setNote] = useState("");
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * The painted cell has to change under the thumb, not after a round trip.
   *
   * `useOptimistic` rather than local state, so the truth arriving from the server replaces the
   * guess without a flicker and a failed write reverts by itself. Before this the strip staged
   * changes and waited for a Save press, which is what made a tapped day and a saved day look
   * alike — see the comment on `paint`.
   */
  const [optimistic, addOptimistic] = useOptimistic(
    rows,
    (current: FortnightRow[], change: Stroke) =>
      current.map((row) =>
        row.profileId !== change.profileId
          ? row
          : {
              ...row,
              cells: row.cells.map((cell, index) =>
                days[index] === change.date
                  ? {
                      state: change.now,
                      note: change.now === null ? null : note.trim() || null,
                    }
                  : cell,
              ),
            },
      ),
  );

  const selected =
    optimistic.find((row) => row.profileId === selectedId) ?? null;

  /**
   * A tap is the whole act.
   *
   * There used to be a select-then-save step, and it was the worst thing in the app: a staged day
   * was painted in the state you were about to set, so a day you had tapped and a day you had
   * actually told your family about differed by a two-pixel ring. Walking away without pressing
   * Save looked exactly like having pressed it, and painting three days with the mode left on its
   * default confirmed the mistake back to you in the mark for the opposite meaning.
   *
   * Writing on the tap costs nothing at the storage layer: `merge` in `lib/presence/ranges.ts`
   * already collapses consecutive single-day writes into the one row a batched save would have
   * produced. What it buys is that nothing on screen can mean "true, but not yet said".
   */
  function paint(row: FortnightRow, index: number) {
    if (!row.editable || pending) return;
    const date = days[index];
    const was = row.cells[index];
    // Tapping a day that already says what the brush says takes it back, so the same gesture
    // undoes itself and nobody has to find a third control to clear one day.
    const now = was.state === mode ? null : mode;

    const change: Stroke = { profileId: row.profileId, date, was, now };
    startTransition(async () => {
      addOptimistic(change);
      setStroke(change);
      await savePresence(null, formOf(row.profileId, [date], now, note));
    });
  }

  /** Put back exactly what was there, note included. */
  function undo() {
    if (!stroke || pending) return;
    const { profileId, date, was } = stroke;
    startTransition(async () => {
      addOptimistic({ ...stroke, now: was.state });
      setStroke(null);
      await savePresence(
        null,
        formOf(profileId, [date], was.state, was.note ?? ""),
      );
    });
  }

  if (!selected) {
    return (
      <Board
        days={days}
        rows={optimistic}
        onPick={undefined}
        selectedId={null}
      />
    );
  }

  return (
    <div>
      <Board
        days={days}
        rows={optimistic}
        selectedId={selectedId}
        onPick={editable.length > 1 ? setSelectedId : undefined}
      />

      <div className="mt-8 border-t border-border pt-6">
        <p className="font-copy text-base text-muted-foreground">
          {selected.profileId === viewerProfileId
            ? "Tap a day to say you'll be here. Tap it again to take it back."
            : `You're saying this for ${first(selected.name)}.`}
        </p>
        {/* Reserved: these sentences differ in length and the strip below must not move. */}
        <p className="font-copy mt-1 min-h-[1.75rem] text-base text-muted-foreground">
          {describeHorizon(
            selected.horizon,
            selected.profileId === viewerProfileId,
            first(selected.name),
          )}
        </p>

        <div className="mt-4">
          <Brush
            mode={mode}
            onMode={setMode}
            self={selected.profileId === viewerProfileId}
            name={first(selected.name)}
          />
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {days.map((day, index) => (
            <Cell
              key={day}
              day={day}
              cell={selected.cells[index]}
              onPaint={() => paint(selected, index)}
            />
          ))}
        </div>

        <div className="mt-4">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder="Add a note"
            aria-label="A note to go with the days you paint"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {/*
            The undo is the whole safety net now that a tap writes. It carries what the day said
            before — note and all — because painting over a day deletes the only writing anybody
            does in this app, and restoring the state while dropping the reason would be a worse
            kind of loss than not offering undo at all.
          */}
          {/*
            Its own line with its height reserved, so the first paint of the day does not push the
            page around by appearing. On a screen whose whole point is that a tap writes, the thing
            that says what was written must not itself be a layout event.
          */}
          <p className="font-copy mt-2 min-h-[1.5rem] text-sm text-muted-foreground">
            {stroke ? (
              <>
                {describeStroke(stroke)}{" "}
                <button
                  type="button"
                  onClick={undo}
                  disabled={pending}
                  className="text-primary underline underline-offset-4 disabled:opacity-50"
                >
                  Undo
                </button>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}

/** The overview. Rows a viewer may speak for are selectable; the rest are just read. */
function Board({
  days,
  rows,
  selectedId,
  onPick,
}: {
  days: string[];
  rows: FortnightRow[];
  selectedId: string | null;
  onPick?: (profileId: string) => void;
}) {
  return (
    <table className="w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className="w-px" aria-label="Person" />
          {days.map((day) => (
            <th
              key={day}
              scope="col"
              className="pb-2 text-center text-[0.5625rem] font-medium uppercase tracking-wider text-muted-foreground tabular-nums"
            >
              <span className="block">{formatCalendarDate(day, "EEEEE")}</span>
              <span className="block opacity-70">
                {formatCalendarDate(day, "d")}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const selected = row.profileId === selectedId;
          return (
            <tr key={row.profileId}>
              <th
                scope="row"
                className="border-t border-border py-2 pr-3 text-left font-normal"
              >
                {onPick && row.editable ? (
                  <button
                    type="button"
                    onClick={() => onPick(row.profileId)}
                    aria-pressed={selected}
                    className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PersonBadge name={row.name} size={24} />
                    <span
                      className={cn(
                        "font-copy text-sm",
                        selected &&
                          "font-semibold underline underline-offset-4",
                      )}
                    >
                      {first(row.name)}
                    </span>
                  </button>
                ) : (
                  <span className="flex items-center gap-2">
                    <PersonBadge name={row.name} size={24} />
                    <span
                      className={cn(
                        "font-copy text-sm",
                        selected && "font-semibold",
                      )}
                    >
                      {first(row.name)}
                    </span>
                  </span>
                )}
              </th>
              {row.cells.map((cell, index) => (
                <td
                  key={days[index]}
                  className={cn(
                    "border-t border-border px-0.5 py-2",
                    selected && "bg-accent/40",
                  )}
                >
                  <span
                    title={`${first(row.name)} — ${formatCalendarDate(days[index], "EEE d MMM")}: ${describeState(cell.state)}${cell.note ? ` (${cell.note})` : ""}`}
                    className={cn(
                      "mx-auto block aspect-square w-full max-w-5 rounded-full border",
                      cell.state === "AROUND" &&
                        "border-foreground bg-foreground",
                      cell.state === "AWAY" && "border-foreground",
                      cell.state === null && "border-dashed border-border",
                    )}
                  />
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The brush: what a tap means.
 *
 * A persistent mode rather than a cycle-on-tap, because three states across fourteen cells is
 * exactly what a mode is for — "these five days are all away" is one setting and five taps, not
 * ten. What is gone is the *deferred* part: the mode says what the next tap does, and the tap does
 * it.
 */
function Brush({
  mode,
  onMode,
  self,
  name,
}: {
  mode: Setting;
  onMode: (next: Setting) => void;
  self: boolean;
  name: string;
}) {
  const options: { setting: Setting; label: string }[] = [
    { setting: "AROUND", label: self ? "I'll be here" : `${name} will` },
    { setting: "AWAY", label: self ? "I won't" : `${name} won't` },
    { setting: null, label: self ? "Nothing said" : `${name} hasn't said` },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="What a tap says"
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const on = option.setting === mode;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onMode(option.setting)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-input text-muted-foreground hover:bg-accent",
            )}
          >
            {/* The same three marks the calendar uses, so the brush reads as a key to it. */}
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

/** One day, at the size of a finger. */
function Cell({
  day,
  cell,
  onPaint,
}: {
  day: string;
  cell: { state: Setting; note: string | null };
  onPaint: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPaint}
      aria-label={`${formatCalendarDate(day, "EEEE d MMMM")} — ${describeState(cell.state)}`}
      title={cell.note ?? undefined}
      className="group flex flex-col items-center gap-1 focus-visible:outline-none"
    >
      <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {formatCalendarDate(day, "EEEEE")}
      </span>
      <span
        className={cn(
          "flex aspect-square w-full max-w-12 items-center justify-center rounded-full border text-sm tabular-nums transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
          cell.state === "AROUND" &&
            "border-foreground bg-foreground text-background",
          cell.state === "AWAY" && "border-foreground text-foreground",
          cell.state === null &&
            "border-dashed border-input text-muted-foreground",
        )}
      >
        {formatCalendarDate(day, "d")}
      </span>
    </button>
  );
}

/**
 * How far ahead this person has spoken.
 *
 * Names the day rather than counting them: "said through Sunday" is a fact you can check against
 * your own week, where "said for 4 more days" is arithmetic you have to do before you can act.
 */
function describeHorizon(
  horizon: Horizon,
  self: boolean,
  name: string,
): string {
  const who = self ? "You've" : `${name} has`;
  switch (horizon.kind) {
    case "open":
      return `${who} said, until further notice.`;
    case "unsaid":
      return `${self ? "You haven't" : `${name} hasn't`} said anything about today yet.`;
    case "through":
      return `${who} said through ${formatCalendarDate(horizon.date, "EEEE d MMMM")}.`;
  }
}

/** One vocabulary for the three states, everywhere. */
function describeState(state: Setting): string {
  return state === "AROUND"
    ? "here"
    : state === "AWAY"
      ? "away"
      : "nothing said";
}

function describeStroke(stroke: Stroke): string {
  const day = formatCalendarDate(stroke.date, "EEE d MMM");
  return stroke.now === null
    ? `${day} taken back.`
    : `${day} set to ${describeState(stroke.now)}.`;
}

/** The action still speaks `FormData`, so the form still works with JavaScript unavailable. */
function formOf(
  profileId: string,
  dates: string[],
  state: Setting,
  note: string,
): FormData {
  const form = new FormData();
  form.set("profileId", profileId);
  form.set("state", state ?? "");
  form.set("note", state === null ? "" : note);
  for (const date of dates) form.append("day", date);
  return form;
}

function first(name: string): string {
  return name.split(" ")[0];
}
