/**
 * Client environment — only `EXPO_PUBLIC_*` vars, which Metro inlines into the bundle.
 *
 * The native counterpart of the web's `lib/env/client.ts`, and it exists for the same reason: so a
 * missing value fails once, at startup, with a message naming the fix — rather than as a fetch to
 * `undefined/api/v1/board` somewhere deep in a screen.
 *
 * There is nothing secret here and there must never be. `EXPO_PUBLIC_*` values are compiled into
 * the shipped bundle and are readable by anyone who unpacks the app.
 */

/**
 * Each key MUST be a *static* `process.env.EXPO_PUBLIC_x` member access. Metro replaces these
 * textually at bundle time; a computed `process.env[key]` is not inlined and reads `undefined` on
 * device. This is the same rule, for the same reason, as the `NEXT_PUBLIC_*` note in
 * `lib/env/client.ts` on the web.
 */
const raw = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || undefined,
};

function required(name: keyof typeof raw): string {
  const value = raw[name];
  if (!value) {
    throw new Error(
      `Missing ${name}.\n\n` +
        `Copy mobile/.env.example to mobile/.env.local and set it to the origin of the web app ` +
        `you want to talk to. In local development that is the devcontainer's published port — ` +
        `run \`grep PORT .devcontainer/docker-compose.worktree.yml\` from the repository root to ` +
        `find it, since it is derived per worktree rather than fixed.\n\n` +
        `Expo CLI watches .env files, but the value is inlined into the bundle rather than read ` +
        `at runtime — so if an edit does not take, restart Metro (\`pnpm start\`).`,
    );
  }
  return value;
}

export const env = {
  /**
   * The origin of the Next app this client talks to. Must match that server's own
   * `resolveBaseUrl()` exactly: Better Auth pins its `baseURL` from the same value and validates
   * `Origin` against it, so a near-miss (a trailing slash, `127.0.0.1` for `localhost`, http for
   * https) fails as an opaque auth rejection rather than a connection error.
   */
  get apiUrl(): string {
    return required('EXPO_PUBLIC_API_URL').replace(/\/$/, '');
  },
};
