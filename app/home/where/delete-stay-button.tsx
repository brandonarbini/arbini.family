"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { removeStay } from "@/app/home/where/actions";
import type { ActionResult } from "@/app/home/where/validations";
import { Button } from "@/components/ui/button";

/**
 * Its own form rather than a button inside the edit form: nesting forms is invalid HTML, and a
 * submit button that deletes would fire on Enter in any text field.
 *
 * No confirmation dialog. A stay is a line on a calendar, not a document — re-adding one takes
 * seconds, and a modal on every removal would make correcting a typo feel consequential.
 */
export function DeleteStayButton({ stayId }: { stayId: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(removeStay, null);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="stayId" value={stayId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label="Remove this stay"
        title={state?.ok === false ? state.formError : undefined}
      >
        <Trash2 className="text-muted-foreground" aria-hidden />
      </Button>
    </form>
  );
}
