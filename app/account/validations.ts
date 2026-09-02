import { z } from "zod";

export const deletePasskeySchema = z.object({ passkeyId: z.uuid() });

export type ActionResult = { ok: true } | { ok: false; formError: string };
