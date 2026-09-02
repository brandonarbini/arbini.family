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

  // The app's canonical origin, and the single source of truth for Better Auth's `baseURL` and
  // the WebAuthn relying party. Passkey registration compares the origin byte-for-byte against
  // what the browser actually used, so this must be the URL typed into the address bar — not
  // necessarily the port the server binds to.
  //
  // Optional so a fresh clone boots; `resolveBaseUrl()` in lib/urls.ts falls back to
  // `http://localhost:${PORT ?? 3000}`, which is right for development and wrong everywhere else.
  APP_URL: z.url().optional(),
  PORT: z.coerce.number().int().positive().optional(),

  // Signs Better Auth's session cookies. The library reads this from the environment itself; it
  // is declared here only so an absent value fails at boot with a named error rather than at the
  // first sign-in. Generate with `openssl rand -hex 32`.
  //
  // Required in production via the refinement below: Better Auth falls back to a development
  // default that must never sign a real session.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "must be at least 32 characters")
    .optional(),

  // --- Email (Postmark) — degrades cleanly when absent -----------------------
  // Both optional. With either missing, `isEmailConfigured()` is false and magic links are logged
  // to the server console in development instead of sent, so the sign-in flow stays exercisable
  // without a Postmark token. In production an absent token is an error, not a fallback — see
  // lib/email.ts.
  POSTMARK_API_TOKEN: z.string().min(1).optional(),
  POSTMARK_FROM_EMAIL: z.email().optional(),

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

const refinedServerSchema = serverSchema.superRefine((data, ctx) => {
  // Every production-mode runtime needs a real secret, including a local `next build`: Better
  // Auth refuses its development default under NODE_ENV=production, and a session signed with a
  // guessable key is forgeable.
  if (data.NODE_ENV === "production" && !data.BETTER_AUTH_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["BETTER_AUTH_SECRET"],
      message: "required in production",
    });
  }
  // Gated on VERCEL_ENV rather than NODE_ENV because a preview deployment derives its own unique
  // origin and must not be pinned to the production one.
  if (data.VERCEL_ENV === "production" && !data.APP_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["APP_URL"],
      message: "required in production",
    });
  }
});

export type ServerEnv = z.infer<typeof serverSchema>;

// `z.object` strips unknown keys, so the rest of `process.env` is ignored.
export const env: ServerEnv = parseEnv(
  refinedServerSchema,
  withoutEmptyStrings(process.env),
  "server",
);
