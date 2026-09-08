import { z } from "zod";

export const deletePasskeySchema = z.object({ passkeyId: z.uuid() });

/**
 * A rename. The name is the whole point of the field, so an empty one is a failure rather than a
 * way to clear it — a row with no name falls back to naming the authenticator, which is a better
 * answer than a blank line but not one you ask for by submitting nothing.
 */
export const renamePasskeySchema = z.object({
  passkeyId: z.uuid(),
  name: z.string().trim().min(1).max(60),
});

export type ActionResult = { ok: true } | { ok: false; formError: string };
