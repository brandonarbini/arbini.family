import { env } from "@/lib/env/server";

/**
 * The app's canonical origin, resolved once.
 *
 * Pinned from configuration rather than read from the request's `Host` header. A header-derived
 * origin lets whoever controls the header decide where session cookies are scoped and where
 * magic-link redirects land; for an app whose entire security model is "only these five
 * addresses", that is the wrong knob to leave reachable.
 *
 * Order matters. `APP_URL` wins everywhere it is set. `VERCEL_URL` covers preview deployments,
 * which mint a unique origin per deployment that nobody can know in advance — it arrives without
 * a scheme, hence the prefix. Localhost is the last resort, and `PORT` is honoured because the
 * devcontainer publishes the app on a per-workspace port rather than 3000.
 */
export function resolveBaseUrl(): string {
  if (env.APP_URL) return stripTrailingSlash(env.APP_URL);
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://localhost:${env.PORT ?? 3000}`;
}

/**
 * The WebAuthn relying party id — the bare hostname, no scheme and no port.
 *
 * A passkey is bound to this value for life. Change it and every registered credential stops
 * being offered, silently: the browser simply finds nothing to present, which reads as "passkeys
 * are broken" rather than "the rp id moved". Deriving it from the same origin the credential was
 * created against is what keeps the two from drifting apart.
 */
export function resolveRpId(): string {
  return new URL(resolveBaseUrl()).hostname;
}

/** An absolute URL for `path` against the canonical origin. */
export function absoluteUrl(path: string): string {
  return new URL(path, `${resolveBaseUrl()}/`).toString();
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
