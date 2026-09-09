"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { decide, removePoll } from "@/app/polls/actions";
import { Button } from "@/components/ui/button";

/**
 * Closing an ask.
 *
 * Deliberately a person's decision rather than an automatic one. The tally makes the tradeoff
 * legible — who can make which date, and who cannot — but which date the family actually picks is
 * not arithmetic. Auto-settling on the highest count would also mean settling before everyone has
 * answered, which is the one thing guaranteed to make people stop answering.
 */
export function SettleButton({
  pollId,
  optionId,
  label,
  warning,
}: {
  pollId: string;
  optionId: string;
  label: string;
  /**
   * Why this option is a bad idea, if it is — "Addison's away — Vanguard".
   *
   * Present only when somebody has said they will not be there on this option's day. When it is,
   * settling takes two presses: the first states the problem, the second goes ahead anyway.
   */
  warning?: string;
}) {
  const [state, formAction, pending] = useActionState(decide, null);
  const [armed, setArmed] = useState(false);

  /*
   * Two presses rather than a modal, and only when there is something to say.
   *
   * The board already knows the one fact that would make somebody stop — that a person has said
   * they are away that day — and it used to render that fact as grey context beside every option
   * equally, which is a thing you read past. Putting it *in the button* is the difference between
   * publishing it and saying it.
   *
   * It warns rather than refuses. Settling a date somebody cannot make is a legitimate decision —
   * the family may go camping without Addison — and an app that blocked it would be an app that
   * knows better than the family, which this one is careful never to be.
   */
  if (warning && !armed) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" size="sm" onClick={() => setArmed(true)}>
          {label}
        </Button>
        <span className="font-copy text-xs text-primary">{warning}</span>
      </span>
    );
  }

  return (
    <form
      action={formAction}
      className="inline-flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <input type="hidden" name="pollId" value={pollId} />
      <input type="hidden" name="optionId" value={optionId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {armed ? "Settle anyway" : label}
      </Button>
      {armed ? (
        <>
          <span className="font-copy text-xs text-primary">{warning}</span>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            Never mind
          </button>
        </>
      ) : null}
      {state && !state.ok && state.formError ? (
        <span role="alert" className="text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}

/** Reopening is ordinary — plans change, and a new ask would lose every answer. */
export function ReopenButton({ pollId }: { pollId: string }) {
  const [state, formAction, pending] = useActionState(decide, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="pollId" value={pollId} />
      <input type="hidden" name="optionId" value="" />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Reopen
      </Button>
      {state && !state.ok && state.formError ? (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}

export function DeletePollButton({ pollId }: { pollId: string }) {
  const [state, formAction, pending] = useActionState(removePoll, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="pollId" value={pollId} />
      {/*
        The only destructive control on the page, and the only one that looks it. It sat in the
        same quiet ghost as everything else, which made "Delete" read as one more thing to try.
      */}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Delete
      </Button>
      {state && !state.ok && state.formError ? (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}
