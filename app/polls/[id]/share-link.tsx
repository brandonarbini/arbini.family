"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Copy the poll's URL.
 *
 * The link is how this feature reaches anyone — it gets pasted into the family chat, which is
 * where a 15-year-old's attention actually is. So the copy button is the second most important
 * control on the page, after the answer buttons themselves.
 *
 * The URL is read from `location` rather than passed in from the server. It has to be the origin
 * the person is actually on: a preview deployment and production serve the same poll, and a
 * server-rendered absolute URL would hand somebody a link to the wrong one.
 */
export function ShareLink() {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access is refused on an insecure origin and in some in-app browsers. The
          // URL is in the address bar either way, so there is nothing to recover — saying so
          // would be noise on a control whose failure is self-evident.
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
