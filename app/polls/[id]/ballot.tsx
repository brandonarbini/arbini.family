"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { answer } from "@/app/polls/actions";
import type { ReplyKind } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * The three buttons, and the only thing on this page anyone has to touch.
 *
 * Three submit buttons rather than a radio group or a select: the buttons *are* the actions, so
 * there is nothing to choose and then confirm. Tapping the answer you already gave clears it,
 * putting you back to silent rather than to a no — the only way to undo without a fourth control.
 *
 * `useOptimistic` fills the button on tap. Without it the answer takes a server round trip to
 * appear, and a control that does not respond to a thumb reads as broken long before it reads as
 * slow — which on a ballot means people stop tapping.
 */

const KINDS: { kind: ReplyKind; label: string }[] = [
  { kind: "YES", label: "Yes" },
  { kind: "MAYBE", label: "Maybe" },
  { kind: "NO", label: "No" },
];

export function AnswerButtons({
  optionId,
  profileId,
  current,
}: {
  optionId: string;
  profileId: string;
  current: ReplyKind | null;
}) {
  const [state, formAction] = useActionState(answer, null);
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current);

  return (
    <div>
      <form
        action={formAction}
        className="flex gap-2"
        // Submitted through a transition so the optimistic value is applied in the same tick the
        // action starts; setting it in a click handler outside one would be reverted immediately.
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const next =
            submitter instanceof HTMLButtonElement ? submitter.value : "";
          startTransition(() =>
            setOptimistic(next === "" ? null : (next as ReplyKind)),
          );
        }}
      >
        <input type="hidden" name="optionId" value={optionId} />
        <input type="hidden" name="profileId" value={profileId} />
        {KINDS.map(({ kind, label }) => {
          const chosen = optimistic === kind;
          return (
            <button
              key={kind}
              type="submit"
              name="kind"
              // Re-tapping your current answer submits "", which clears it.
              value={chosen ? "" : kind}
              aria-pressed={chosen}
              className={cn(
                "flex-1 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                // `touch-manipulation` removes the 300ms double-tap delay, which is the single
                // most-felt lag on a control somebody taps three times in a row.
                "touch-manipulation select-none active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                chosen
                  ? KIND_STYLES[kind]
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </form>
      {state && !state.ok && state.formError ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Yes gets the one green in the palette — the `--success` pair, which has been sitting unused in
 * `globals.css` waiting for something that genuinely means "good". No gets muted rather than
 * destructive red: declining a date is ordinary, and colouring it like a deletion would make the
 * ballot feel like it is scolding people for having plans.
 */
const KIND_STYLES: Record<ReplyKind, string> = {
  YES: "border-success bg-success text-success-foreground",
  MAYBE: "border-foreground/40 bg-foreground/10 text-foreground",
  NO: "border-input bg-muted text-muted-foreground line-through",
};
