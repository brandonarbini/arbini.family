"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { removePasskey } from "@/app/account/actions";
import type { ActionResult } from "@/app/account/validations";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

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
          const result = await authClient.passkey.addPasskey({
            // Named for the device rather than left blank, so a list of three passkeys is not
            // three identical rows.
            name: deviceLabel(),
          });
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

/** A rough, human-readable guess at the device, used only as a default label. */
function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone or iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  return "Passkey";
}
