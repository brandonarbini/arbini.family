import { expoClient } from '@better-auth/expo/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
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

/**
 * The passkey plugin, loaded only if its native module is actually present.
 *
 * `@lobehub/expo-better-auth-passkey` throws `Cannot find native module` at *import* time when the
 * binary does not contain it — which is every Expo Go session, and any build made before the
 * dependency was added. A static import therefore does not degrade the passkey button; it stops
 * the app booting at all, before a single screen renders.
 *
 * So it is required lazily and the failure is caught. Where the module is missing the app falls
 * back to `passkeyClient()`, better-auth's web client: its shape keeps `authClient.signIn.passkey`
 * typed and callable, and calling it fails cleanly (there is no `navigator.credentials` in React
 * Native) rather than taking the process with it. `passkeysSupported` below is what the UI should
 * consult so it can decline to offer something that cannot work.
 */
function loadPasskeyPlugin(): { plugin: ReturnType<typeof passkeyClient>; supported: boolean } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@lobehub/expo-better-auth-passkey') as {
      expoPasskeyClient: () => ReturnType<typeof passkeyClient>;
    };
    return { plugin: mod.expoPasskeyClient(), supported: true };
  } catch {
    return { plugin: passkeyClient(), supported: false };
  }
}

const passkey = loadPasskeyPlugin();

/**
 * Whether this build can actually use passkeys.
 *
 * False in Expo Go. Also false in any build predating the native module, which is the case worth
 * remembering: it is a property of the *binary*, not of the code, so it cannot be inferred from
 * the source in front of you.
 */
export const passkeysSupported = passkey.supported;

export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  plugins: [
    magicLinkClient(),
    /**
     * Passkeys, through the platform credential APIs rather than WebAuthn.
     *
     * The native plugin is a drop-in for the web's `passkeyClient()` — same `signIn.passkey()` and
     * `passkey.addPasskey()` surface — that swaps `navigator.credentials`, which React Native does
     * not have, for `ASAuthorizationController` on iOS and Credential Manager on Android. The
     * *server* needs no change at all: `passkey()` in lib/auth.ts speaks the WebAuthn protocol,
     * and only the thing producing the attestation differs.
     *
     * Because `rpID` is the hostname of the canonical origin, a passkey registered in the browser
     * at arbini.family is the same credential this app offers. One registration, not two.
     */
    passkey.plugin,
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
