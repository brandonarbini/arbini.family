"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "sending" | "sent" | "passkey" | "error";

/**
 * Sign-in: a link by email, or a passkey once one is registered.
 *
 * The one rule that shapes this component: **the outcome shown must not depend on whether the
 * address is one of the family's.** The server declines to send to an unknown address but still
 * returns success (see `sendMagicLink` in lib/auth.ts), and this form must not undo that by
 * reporting anything more specific. So there is a single "check your email" state, reached
 * whenever the request itself succeeded.
 */
export function SignInForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function requestMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const { error: requestError } = await authClient.signIn.magicLink({
      email,
      callbackURL: returnTo,
    });

    if (requestError) {
      // Only genuine transport/rate-limit failures land here — never "no such user", because the
      // server does not distinguish. Rate limiting is the one case a family member will actually
      // hit, so it gets its own words.
      setStatus("error");
      setError(
        requestError.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "Something went wrong. Try again.",
      );
      return;
    }

    setStatus("sent");
  }

  async function signInWithPasskey() {
    setStatus("passkey");
    setError(null);

    const result = await authClient.signIn.passkey();

    if (result?.error) {
      setStatus("error");
      setError(
        "That didn't work. Use the email link instead, then add a passkey from your account.",
      );
      return;
    }

    // A passkey sign-in resolves in place rather than navigating, so the redirect is ours to do.
    router.push(returnTo);
    router.refresh();
  }

  if (status === "sent") {
    return (
      <div className="mt-8 rounded-lg border bg-card p-5">
        <MailCheck className="size-5 text-primary" aria-hidden />
        <h2 className="mt-3 text-sm font-medium">Check your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          If that address is one of ours, a sign-in link is on its way. It works
          once and expires in ten minutes.
        </p>
        <Button
          variant="link"
          className="mt-3 h-auto p-0"
          onClick={() => setStatus("idle")}
        >
          Use a different address
        </Button>
      </div>
    );
  }

  const busy = status === "sending" || status === "passkey";

  return (
    <div className="mt-8">
      <form onSubmit={requestMagicLink} className="flex flex-col gap-3">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email webauthn"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@arbini.family"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || email.length === 0}>
          {status === "sending" ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Sending
            </>
          ) : (
            "Email me a link"
          )}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={signInWithPasskey}
        disabled={busy}
      >
        <KeyRound aria-hidden />
        {status === "passkey" ? "Waiting for your device" : "Use a passkey"}
      </Button>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
