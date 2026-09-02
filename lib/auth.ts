import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { sendMagicLinkEmail } from "@/lib/email";
import { env } from "@/lib/env/server";
import { isFamilyEmail, parseFamilyEmails } from "@/lib/family";
import { prisma } from "@/lib/prisma";
import { resolveBaseUrl, resolveRpId } from "@/lib/urls";

/**
 * The single place `betterAuth()` is called. Everything else imports `auth` from here.
 *
 * There is no sign-up and no password. The five accounts are seeded; a person proves who they are
 * with a link sent to an address we wrote down in advance, and registers a passkey afterwards so
 * they stop needing the email at all.
 */

/**
 * Parsed once at module load rather than per request. The allowlist cannot change without a
 * redeploy, so re-splitting the string on every sign-in attempt would be work done to reach the
 * same answer.
 */
const FAMILY_ALLOWLIST = parseFamilyEmails(env.FAMILY_EMAILS);

/** Ten minutes: long enough to switch to a phone and find the mail, short enough to matter. */
const MAGIC_LINK_TTL_SECONDS = 600;

export const auth = betterAuth({
  // Pinned from configuration, never from the `Host` header — see lib/urls.ts.
  baseURL: resolveBaseUrl(),

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  advanced: {
    // Every id in schema.prisma is `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`, so
    // Postgres mints them and the library must not. Its own default generates base62 strings,
    // which do not fit a uuid column — the insert fails with a type error rather than anything
    // that names the cause.
    database: { generateId: false },
  },

  // Explicit rather than omitted. There is no password anywhere in this app, and the schema's
  // `Account.password` column exists only because Better Auth's adapter expects it.
  emailAndPassword: { enabled: false },

  // Backed by the RateLimit table rather than in-memory counters, so the limits survive a cold
  // start. An in-process counter resets whenever a new instance boots, which is exactly the
  // moment an attacker benefits from it resetting.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
  },

  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_TTL_SECONDS,

      // Stops the *account* from being created when an unknown address somehow reaches
      // verification. Note this gate fires at verify time, not at send time, which is why the
      // allowlist below lives in `sendMagicLink` — by the time `disableSignUp` has an opinion,
      // the email has already gone out.
      disableSignUp: true,

      // Hashed, not plain. The token in `Verification.value` is a bearer credential: stored in
      // the clear, anyone who can read the table — a backup, a snapshot, a stray query — can mint
      // a session as any family member. Hashing means a leaked row is not a working link.
      storeToken: "hashed",

      // Tighter than the global limit. This is the one unauthenticated endpoint that causes mail
      // to be sent, so it is both the spam vector and the enumeration vector.
      rateLimit: { window: 300, max: 5 },

      /**
       * The allowlist gate.
       *
       * Deliberately here rather than in a `before` hook that throws. A hook rejecting the
       * request would return a different status than an accepted one, and that difference is an
       * oracle: anyone could probe addresses one at a time and learn which belong to the family.
       * Declining to send inside this callback leaves Better Auth's response byte-identical —
       * every caller is told to go check their email — while no mail is sent and, with
       * `disableSignUp`, no account can result.
       *
       * The unknown address does leave a short-lived row in `Verification`. That is deliberate:
       * suppressing it would require failing the request, which is the oracle again. The token is
       * hashed, expires in ten minutes, and verifies to nothing.
       */
      sendMagicLink: async ({ email, url }) => {
        if (!isFamilyEmail(email, FAMILY_ALLOWLIST)) {
          console.warn(
            "[auth] magic link requested for an address outside the family allowlist",
          );
          return;
        }
        await sendMagicLinkEmail({
          email,
          url,
          expiresInMinutes: MAGIC_LINK_TTL_SECONDS / 60,
        });
      },
    }),

    passkey({
      rpID: resolveRpId(),
      rpName: "Arbini Family",
      origin: resolveBaseUrl(),
    }),

    // Must stay last: nextCookies wraps the response so `Set-Cookie` reaches Next's cookie store
    // from Server Actions and Route Handlers. Registered anywhere else in this array and sign-in
    // appears to succeed while no session is ever persisted.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
