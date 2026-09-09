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

  /*
   * One press, and the label keeps naming what it settles on.
   *
   * This used to arm: the first press turned it into "Settle anyway" and the second committed. Two
   * things were wrong with that. Settling is *reversible* — `ReopenButton` is two inches away and
   * `decide("")` puts it back — so it was the ceremony-heavy control on a page whose one
   * irreversible action had none at all. And at the moment of commit the button stopped saying
   * which option it was committing to, which on an ask with two dated choices is genuinely
   * ambiguous.
   *
   * The warning stays, permanently, beside the button. It is the fact worth knowing; it was never
   * the press that needed slowing down.
   */
  return (
    <form
      action={formAction}
      className="inline-flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <input type="hidden" name="pollId" value={pollId} />
      <input type="hidden" name="optionId" value={optionId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {label}
      </Button>
      {warning ? (
        <span className="font-copy text-xs text-primary">{warning}</span>
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
        <span role="alert" className="text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}

/**
 * The one thing on this page that cannot be undone.
 *
 * It was a single unconfirmed press that destroyed the ask, every option, and everyone's answers,
 * and then redirected to a list that could not show you what had gone. The evidence of the mistake
 * was the absence of the thing, which is the least detectable failure there is — and it sat in a
 * flat row beside two reversible controls, at the bottom of a long scroll, where a thumb arrives.
 *
 * So it takes the two presses that settling used to take, and the armed label says what goes with
 * it. Risk and ceremony now point the same way.
 */
export function DeletePollButton({ pollId }: { pollId: string }) {
  const [state, formAction, pending] = useActionState(removePoll, null);
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setArmed(true)}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        Delete this ask
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="inline-flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <input type="hidden" name="pollId" value={pollId} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Delete it and everyone&rsquo;s answers
      </Button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs text-muted-foreground underline underline-offset-4"
      >
        Never mind
      </button>
      {state && !state.ok && state.formError ? (
        <span role="alert" className="text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}
