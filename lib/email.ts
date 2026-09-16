import "server-only";

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { render } from "react-email";
import { ServerClient } from "postmark";
import { MagicLinkEmail } from "@/emails/magic-link";
import { env } from "@/lib/env/server";

/**
 * Transactional email, sent through Postmark.
 *
 * Postmark is required configuration, in every environment (lib/env/server.ts says why). Outside
 * production the token is a *sandbox* server token: the send really happens and the message is
 * readable in Postmark's activity UI, but nothing is delivered, so no real address is ever mailed
 * from a development run. There is no not-configured branch here on purpose — a send that
 * silently does nothing is the failure mode this module is shaped to make impossible.
 */

/**
 * Not configuration. Postmark rejects a From address that is not a verified sender signature or a
 * verified domain, so a value an operator could vary per environment is a value that can only be
 * varied into a hard send-time failure. arbini.family is verified as a whole domain.
 */
const FROM_ADDRESS = "noreply@arbini.family";

let client: ServerClient | null = null;

function getClient(): ServerClient {
  if (!client) {
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
  // Alongside the send, never instead of it. A sandbox token means the mail is not delivered
  // anywhere you can read it as the recipient, so development still needs the link on disk.
  if (env.NODE_ENV !== "production") {
    await writeDevMagicLink(url);
  }

  const component = MagicLinkEmail({ url, expiresInMinutes });
  const [html, text] = await Promise.all([
    render(component),
    render(component, { plainText: true }),
  ]);

  await getClient().sendEmail({
    From: FROM_ADDRESS,
    To: email,
    Subject: "Sign in to Arbini Family",
    HtmlBody: html,
    TextBody: text,
    MessageStream: "outbound",
  });
}

/**
 * The most recent magic link, dropped on disk in development.
 *
 * A sandbox send is not readable as the recipient, and stdout is only useful to whoever is
 * watching the dev server — nobody, when it was started in the background, by a script, or by
 * somebody else. A file at a known path makes the link retrievable either way:
 * `pnpm dev:magic-link`.
 *
 * Overwrites rather than appends, so the file always holds the link you just asked for instead of
 * a history you have to read the end of.
 *
 * Gated on NODE_ENV so this cannot put a live credential on a deployed filesystem: a magic link
 * written where a log aggregator or a backup can reach it is a credential readable long after the
 * fifteen-minute expiry would have closed the window on the intended recipient. It is also
 * best-effort — a dev convenience must never be the reason sign-in fails, hence the swallowed
 * error.
 */
const DEV_MAGIC_LINK_FILE = ".magic-link.local";

async function writeDevMagicLink(url: string): Promise<void> {
  try {
    await writeFile(
      path.join(process.cwd(), DEV_MAGIC_LINK_FILE),
      `${url}\n`,
      "utf8",
    );
  } catch {
    // Swallowed on purpose — see above.
  }
}
