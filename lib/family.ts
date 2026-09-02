/**
 * Who is allowed in.
 *
 * The hub has no sign-up. Five accounts are seeded and this list is the gate in front of them:
 * Better Auth's `disableSignUp` stops account *creation*, and this stops a sign-in attempt for an
 * address that was never ours from getting as far as an email.
 *
 * Kept free of `process.env` and of any Better Auth import so it stays a pure function of its
 * input — the interesting part is the matching rule, and that should be testable without booting
 * the app or standing up a database.
 */

/** Parse the comma-separated `FAMILY_EMAILS` value into a normalized lookup set. */
export function parseFamilyEmails(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map(normalizeEmail)
      .filter((email) => email.length > 0),
  );
}

/**
 * Is this address one of ours?
 *
 * Matching is exact after trimming and lower-casing, and deliberately no cleverer than that.
 * Gmail treats `t.anner@` and `tanner+hub@` as the same mailbox, but folding those here would
 * *widen* the allowlist — anyone who knows one family address could mint an unbounded number of
 * variants that all pass. An allowlist should only ever admit what was literally written down.
 */
export function isFamilyEmail(
  email: string | undefined | null,
  allowlist: Set<string>,
): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  if (normalized.length === 0) return false;
  return allowlist.has(normalized);
}

/**
 * Case-folded, whitespace-trimmed form. Someone will type `Tanner@` on a phone keyboard that
 * capitalizes the first letter, and that must not be treated as a stranger.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
