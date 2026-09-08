import { expoClient } from '@better-auth/expo/client';
import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/lib/env';
import { expoPasskeyClient } from '@/lib/passkey-client';

/**
 * The single seam between this app and Better Auth, mirroring the web's `lib/auth-client.ts`.
 * Nothing else imports `better-auth/react`; everything else asks this module.
 *
 * Two differences from the web client, both forced by the platform:
 *
 * - It sets `baseURL`. The web client deliberately omits one because it is same-origin; a native
 *   app has no origin to be same as.
 * - It stores the session itself, in the keychain. A browser has a cookie jar; React Native does
 *   not, so `expoClient` keeps the cookie in SecureStore and replays it on each request. Keychain
 *   rather than AsyncStorage because the value is a live credential — anyone holding it is signed
 *   in as that person until it expires.
 *
 * `scheme` must match `expo.scheme` in app.json and the `trustedOrigins` entry in lib/auth.ts.
 * The three are one value written in three places; changing one alone produces a sign-in that
 * completes on the server and never returns to the app.
 */

/**
 * Whether this build can offer passkeys, re-exported so screens have one import for the client and
 * the question they have to ask before showing a button.
 */
export { passkeysSupported } from '@/lib/passkey-client';

/**
 * The keychain namespace for everything auth-related. Exported because `app/auth.tsx` has to write
 * the session cookie under the same prefix the plugin reads from — see the note there.
 */
export const AUTH_STORAGE_PREFIX = 'arbinifamily';

/** Must equal `expo.scheme` in app.json and the `trustedOrigins` entry in lib/auth.ts. */
export const APP_URL_SCHEME = 'arbinifamily';

export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  plugins: [
    magicLinkClient(),
    /**
     * Passkeys, through the platform credential APIs rather than WebAuthn. Ours — see
     * lib/passkey-client.ts for what it replaced and why.
     *
     * Same `signIn.passkey()` and `passkey.addPasskey()` surface as the web's `passkeyClient()`,
     * swapping `navigator.credentials` for `ASAuthorizationController` on iOS. The *server* needs
     * no change at all: `passkey()` in lib/auth.ts speaks the WebAuthn protocol, and only the
     * thing producing the attestation differs.
     *
     * Because `rpID` is the hostname of the canonical origin, a passkey registered in the browser
     * at arbini.family is the same credential this app offers — one credential, two surfaces, and
     * no need to register again here if you already have one from the website.
     */
    expoPasskeyClient(),
    expoClient({
      scheme: APP_URL_SCHEME,
      storagePrefix: AUTH_STORAGE_PREFIX,
      storage: SecureStore,
    }),
  ],
});

/**
 * The session cookie, for requests this app makes outside Better Auth's own client.
 *
 * `authClient.$fetch` attaches credentials on its own, but a plain `fetch` to `/api/v1/*` does
 * not — there is no cookie jar doing it invisibly. Two callers: `mobile/src/lib/api.ts`, and
 * `use-auth-cookie.ts`, which hands the same header to `expo-image` for an avatar.
 */
export async function getSessionCookie(): Promise<string> {
  return authClient.getCookie();
}
