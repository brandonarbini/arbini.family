"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2, Pencil, Trash2, X } from "lucide-react";
import { removePasskey, renamePasskey } from "@/app/account/actions";
import type { ActionResult } from "@/app/account/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import type { PasskeySummary } from "@/lib/passkeys/data";

/**
 * Registering a passkey has to happen in the browser — WebAuthn needs the authenticator — so this
 * is a client component calling the auth client directly rather than a Server Action.
 */
export function AddPasskeyButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="outline"
        disabled={status === "working"}
        onClick={async () => {
          setStatus("working");
          setError(null);
          // No `name`, deliberately. Better Auth spends that one option twice: it goes in the body
          // of verify-registration, where it sets our own `passkeys.name`, *and* on the query of
          // generate-register-options, where it becomes WebAuthn's `user.name` — the account
          // identifier the authenticator stores and shows as the username, and the label you pick
          // between in the sign-in sheet. Passing a device guess here is how 1Password ends up
          // filing this credential under "Mac" instead of under your email address. Left empty,
          // the plugin falls back to the session's email for the ceremony and to null for the row,
          // and the row names its authenticator instead. See `lib/passkeys/label.ts`.
          const result = await authClient.passkey.addPasskey();
          setStatus("idle");
          if (result?.error) {
            setError(
              result.error.message ??
                "That didn't work. Your device may have cancelled the request.",
            );
            return;
          }
          router.refresh();
        }}
      >
        {status === "working" ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Waiting for your device
          </>
        ) : (
          <>
            <KeyRound aria-hidden />
            Add a passkey
          </>
        )}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One passkey: what it is called, where it lives, and the two things you can do to it.
 *
 * The rename is an inline field rather than a dialog. There is exactly one thing to edit and it is
 * already on screen — putting it behind a modal would ask the reader to lose their place in a list
 * whose whole purpose is comparing the rows to each other.
 */
export function PasskeyRow({ passkey }: { passkey: PasskeySummary }) {
  const [editing, setEditing] = useState(false);

  return editing ? (
    <RenameForm passkey={passkey} onDone={() => setEditing(false)} />
  ) : (
    <div className="flex items-center gap-3">
      <div>
        <p className="font-copy text-base font-semibold">{passkey.label}</p>
        <p className="font-copy text-base text-muted-foreground">
          {passkey.deviceType === "singleDevice"
            ? "This device only"
            : "Synced across your devices"}
        </p>
      </div>
      <div className="ml-auto flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Rename ${passkey.label}`}
          onClick={() => setEditing(true)}
        >
          <Pencil className="text-muted-foreground" aria-hidden />
        </Button>
        <RemovePasskeyButton passkeyId={passkey.id} />
      </div>
    </div>
  );
}

function RenameForm({
  passkey,
  onDone,
}: {
  passkey: PasskeySummary;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(renamePasskey, null);

  // Closing on success has to wait for the action to answer, so it cannot happen in the submit
  // handler. `state` is the only place that answer arrives.
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction}>
      <input type="hidden" name="passkeyId" value={passkey.id} />
      <div className="flex items-center gap-2">
        <Input
          name="name"
          // Starts from what the row already says rather than from an empty field: the fallback
          // label is usually most of the answer, and "1Password" wants "1Password — work" more
          // often than it wants to be retyped.
          defaultValue={passkey.label}
          maxLength={60}
          autoFocus
          // Selected, not just focused. The prefill is a suggestion as often as it is a starting
          // point — "1Password" is usually replaced wholesale rather than appended to — and a
          // caret parked in existing text quietly turns typing into concatenation.
          onFocus={(event) => event.currentTarget.select()}
          disabled={pending}
          aria-label="Passkey name"
          aria-invalid={state?.ok === false}
          onKeyDown={(event) => {
            if (event.key === "Escape") onDone();
          }}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label="Save name"
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label="Cancel"
          onClick={onDone}
        >
          <X className="text-muted-foreground" aria-hidden />
        </Button>
      </div>
      {state?.ok === false ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}

export function RemovePasskeyButton({ passkeyId }: { passkeyId: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(removePasskey, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="passkeyId" value={passkeyId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label="Remove this passkey"
        title={state?.ok === false ? state.formError : undefined}
      >
        <Trash2 className="text-muted-foreground" aria-hidden />
      </Button>
    </form>
  );
}
