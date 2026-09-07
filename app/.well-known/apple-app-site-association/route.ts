import { env } from "@/lib/env/server";
import { IOS_BUNDLE_IDENTIFIER } from "@/lib/native-app";

/**
 * The apple-app-site-association document, which is how iOS decides whether the app is allowed to
 * use passkeys scoped to this domain.
 *
 * Served from a route handler rather than `public/` for two reasons. The path has no file
 * extension, which a static file cannot have while still being served as JSON; and the team id is
 * configuration rather than source, so it belongs in the environment instead of a committed file
 * that would differ per deployment.
 *
 * Only `webcredentials` is declared. That is the service passkeys use — it says "this app may
 * present credentials registered against this hostname". Universal links are a separate service
 * (`applinks`) and this app does not use them: the magic link comes back through the
 * `arbinifamily://` scheme instead, which needs no association at all.
 *
 * The hostname here must equal `resolveRpId()` — the rp id every credential is bound to. If the
 * two ever drift, the platform simply finds no credentials to offer, which reads as "passkeys are
 * broken" rather than "the domains disagree".
 */
export async function GET(): Promise<Response> {
  // Without a team id there is no correct document to serve, and a wrong one is worse than a
  // missing one: the platform caches what it fetches, so a placeholder takes effect immediately
  // while the correction waits behind that cache.
  if (!env.APPLE_TEAM_ID) {
    return new Response("Not found", { status: 404 });
  }

  const body = {
    webcredentials: {
      apps: [`${env.APPLE_TEAM_ID}.${IOS_BUNDLE_IDENTIFIER}`],
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      // Must be application/json. iOS rejects the document outright if it arrives as text/plain,
      // and does so silently.
      "Content-Type": "application/json",
      // Apple's CDN caches this; a short max-age keeps a correction from taking a day to land
      // without making the fetch expensive.
      "Cache-Control": "public, max-age=300",
    },
  });
}
