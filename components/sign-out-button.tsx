"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Sign out, set as colophon type rather than as a button.
 *
 * It lives in the footer now, among the small print, so it takes the same tracked caps as
 * everything around it instead of the app's Button chrome — a filled or bordered control down
 * there would be the one piece of interface left shouting.
 */
export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="uppercase tracking-[0.2em] hover:text-foreground hover:underline hover:underline-offset-4"
      onClick={async () => {
        await authClient.signOut();
        // `refresh` as well as `push`: without it the server components for `/` may be served
        // from the router cache still holding the signed-in render.
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
