import { z } from "zod";
import { parseEnv, withoutEmptyStrings } from "./parse";

/**
 * Server-side environment — THE single place the app reads `process.env` (enforced by the
 * `no-restricted-properties` ESLint rule in eslint.dev-env.mjs). The schema is parsed once at
 * import: a missing/invalid *required* var throws immediately, so a misconfigured build or boot
 * fails loudly instead of surfacing a downstream `undefined`. `next.config.ts` imports this
 * module, so `next build` validates the environment up front.
 *
 * NOTE: intentionally NOT `server-only`. This module must also be importable from Node bootstrap
 * contexts that run outside the React Server condition — `next.config.ts` and `tsx` seed/scripts.
 * Client code must never import it (use `./client`); non-`NEXT_PUBLIC_*` values are never inlined
 * into the browser bundle anyway, so no secret can leak — a stray client import would simply fail
 * validation at runtime.
 *
 * Scaffolded by dev-env (tool.env@1) and yours to edit: add this app's variables below, grouped
 * required vs `.optional()`, and note what an absent optional falls back to.
 */
const serverSchema = z.object({
  // --- This app --------------------------------------------------------------
  DATABASE_URL: z.string().min(1),

  // The sign-in allowlist: comma-separated addresses, read through `parseFamilyEmails` in
  // lib/family.ts. There is no sign-up, so this is the only thing standing in front of the seeded
  // accounts.
  //
  // `.optional()` rather than required, and it fails closed: `parseFamilyEmails(undefined)` returns
  // an empty set, so an unset value admits nobody rather than admitting everybody. That makes a
  // fresh clone bootable without knowing the family's real addresses, which is also why they live
  // in the gitignored `.env.local` rather than the committed `.env`.
  FAMILY_EMAILS: z.string().optional(),

  // --- Platform-injected (read-only; present depending on runtime) -----------
  // NOTE: `NEXT_RUNTIME` is intentionally NOT here — it must be read as the literal
  // `process.env.NEXT_RUNTIME` (see instrumentation.ts) so Next can statically tree-shake
  // per-runtime code. That file is exempt from the rule for the same reason.
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

// `z.object` strips unknown keys, so the rest of `process.env` is ignored.
export const env: ServerEnv = parseEnv(
  serverSchema,
  withoutEmptyStrings(process.env),
  "server",
);
