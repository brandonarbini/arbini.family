import { expoClient } from '@better-auth/expo/client';
import { expoPasskeyClient } from '@lobehub/expo-better-auth-passkey';
import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/lib/env';

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
export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  plugins: [
    magicLinkClient(),
    /**
     * Passkeys, through the platform credential APIs rather than WebAuthn.
     *
     * `expoPasskeyClient()` is a drop-in for the web's `passkeyClient()` — same
     * `signIn.passkey()` and `passkey.addPasskey()` surface — that swaps `navigator.credentials`,
     * which React Native does not have, for `ASAuthorizationController` on iOS and Credential
     * Manager on Android. The *server* needs no change at all: `passkey()` in lib/auth.ts speaks
     * the WebAuthn protocol, and only the thing producing the attestation differs.
     *
     * Because `rpID` is the hostname of the canonical origin, a passkey registered in the browser
     * at arbini.family is the same credential this app offers. One registration, not two.
     *
     * Requires a development or release build — it is a native module, so Expo Go cannot load it
     * — and an associated domain, which is why app.json carries `ios.associatedDomains`.
     */
    expoPasskeyClient(),
    expoClient({
      scheme: 'arbinifamily',
      storagePrefix: 'arbinifamily',
      storage: SecureStore,
    }),
  ],
});

/**
 * The session cookie, for requests this app makes outside Better Auth's own client.
 *
 * `authClient.$fetch` attaches credentials on its own, but a plain `fetch` to `/api/v1/*` does
 * not — there is no cookie jar doing it invisibly. `mobile/src/lib/api.ts` is the only caller.
 */
export async function getSessionCookie(): Promise<string> {
  return authClient.getCookie();
}
