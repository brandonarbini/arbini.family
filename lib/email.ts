import "server-only";

import { render } from "react-email";
import { ServerClient } from "postmark";
import { MagicLinkEmail } from "@/emails/magic-link";
import { env } from "@/lib/env/server";

/**
 * Transactional email, sent through Postmark.
 *
 * Postmark is optional configuration. When it is absent — the default on a fresh clone — sending
 * degrades to logging the link, so the sign-in flow is exercisable locally without a token. That
 * fallback is deliberately restricted to development: a magic link in a deployed log is a
 * credential sitting in a log aggregator, readable by anyone with access to it long after the
 * fifteen-minute expiry would have closed the window on the intended recipient.
 */

let client: ServerClient | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(env.POSTMARK_API_TOKEN && env.POSTMARK_FROM_EMAIL);
}

function getClient(): ServerClient {
  if (!client) {
    if (!env.POSTMARK_API_TOKEN) {
      throw new Error("POSTMARK_API_TOKEN is not configured");
    }
    client = new ServerClient(env.POSTMARK_API_TOKEN);
  }
  return client;
}

interface SendMagicLinkParams {
  email: string;
  url: string;
  expiresInMinutes: number;
}

export async function sendMagicLinkEmail({
  email,
  url,
  expiresInMinutes,
}: SendMagicLinkParams): Promise<void> {
  if (!isEmailConfigured()) {
    if (env.NODE_ENV === "production") {
      // Loud, and without the link: the operator needs to know sign-in is broken, and the log is
      // not a safe place to put a working credential.
      console.error(
        "[email] Postmark is not configured — no magic link was sent",
      );
      return;
    }
    console.warn(`[email] Postmark not configured — magic link: ${url}`);
    return;
  }

  const component = MagicLinkEmail({ url, expiresInMinutes });
  const [html, text] = await Promise.all([
    render(component),
    render(component, { plainText: true }),
  ]);

  await getClient().sendEmail({
    From: env.POSTMARK_FROM_EMAIL!,
    To: email,
    Subject: "Sign in to arbini.family",
    HtmlBody: html,
    TextBody: text,
    MessageStream: "outbound",
  });
}
