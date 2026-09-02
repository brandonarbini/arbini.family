"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { decide, removePoll } from "@/app/polls/actions";
import { Button } from "@/components/ui/button";

/**
 * Closing a poll.
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
}: {
  pollId: string;
  optionId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(decide, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="pollId" value={pollId} />
      <input type="hidden" name="optionId" value={optionId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {label}
      </Button>
      {state && !state.ok && state.formError ? (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {state.formError}
        </span>
      ) : null}
    </form>
  );
}

/** Reopening is ordinary — plans change, and a new poll would lose every answer. */
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
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
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
