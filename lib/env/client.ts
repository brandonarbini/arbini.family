import { z } from "zod";
import { parseEnv } from "./parse";

/**
 * Client-safe environment — ONLY `NEXT_PUBLIC_*` vars, which Next inlines into the browser bundle
 * at build time. Safe to import from Client Components; never put a secret here.
 *
 * This is split from `./server` on purpose: a Client Component importing the server schema would
 * see `undefined` for every non-public key (Next only inlines `NEXT_PUBLIC_*`) and throw in the
 * browser. Keep the two apart even if this file has only one variable in it.
 *
 * Scaffolded by dev-env (tool.env@1) and yours to edit.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_EXAMPLE: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;

// Each key MUST be a *static* `process.env.NEXT_PUBLIC_x` member: Next replaces these textually at
// build time, and a dynamic `process.env[key]` is not inlined — it would read `undefined` in the
// browser. `|| undefined` treats a blank value as unset.
const raw = {
  NEXT_PUBLIC_EXAMPLE: process.env.NEXT_PUBLIC_EXAMPLE || undefined,
};

export const clientEnv: ClientEnv = parseEnv(clientSchema, raw, "client");
