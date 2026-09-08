import { getSetCookie } from '@better-auth/expo/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AUTH_STORAGE_PREFIX, authClient } from '@/lib/auth-client';

/**
 * The key `expoClient` keeps its cookie under: `${storagePrefix}_cookie`.
 *
 * Reaching for it directly is the one piece of coupling in this screen, and it is deliberate —
 * see below. Derived from the same constant the client is configured with so the two cannot drift.
 */
const COOKIE_STORAGE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`;

/**
 * Where the emailed link lands: `arbinifamily://auth?cookie=…`.
 *
 * **Why this screen does the storing.** `@better-auth/expo` only captures a session from a browser
 * flow *it* started — it calls `Browser.openAuthSessionAsync` and reads the callback it is already
 * awaiting. It registers no `Linking` listener at all. A magic link tapped in Mail is the opposite
 * situation: the app is opened *by* the link, with nothing awaiting anything, so the plugin never
 * sees it. Verified rather than assumed — with the plugin alone, `authClient.getCookie()` returned
 * empty on thirty consecutive polls while the session sat unread in the URL.
 *
 * So the app handles its own arrival. The `cookie` parameter is the raw `Set-Cookie` value the
 * server put on the redirect; `getSetCookie` is the plugin's own serialiser for it, exported from
 * the same package, so what lands in the keychain is byte-identical to what the plugin would have
 * written from a response header. Only the storage key is borrowed knowledge.
 *
 * The route also has to exist for a second reason: without it the router renders "Unmatched Route"
 * — with the session token printed on screen.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { cookie } = useLocalSearchParams<{ cookie?: string }>();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cookie) {
        const previous = await SecureStore.getItemAsync(COOKIE_STORAGE_KEY);
        await SecureStore.setItemAsync(
          COOKIE_STORAGE_KEY,
          getSetCookie(cookie, previous ?? undefined),
        );
      }
      if (cancelled) return;

      // Better-auth's own "ask again" signal, and it must come first. `useSession()` elsewhere in
      // the app fired its request before this cookie existed, so without this it would sit on a
      // null answer it has no reason to revisit — including in the gate in _layout.tsx, which
      // would then bounce us straight back out of the app we are about to enter.
      authClient.$store.notify('$sessionSignal');

      // Then ask directly, and wait for the answer.
      //
      // This screen used to read `useSession()` and navigate once `isPending` went false. That
      // looks equivalent and is not: `notify` does not set `isPending` synchronously — the atom
      // defers its fetch through `Promise.resolve().then(...)` — so for one render the hook still
      // held the *previous* answer, from the request made before the cookie existed. Not pending,
      // and null. The screen read that as "the link did not work" and redirected to sign-in
      // roughly 200ms before the real answer arrived. It was invisible against a local server,
      // where the first request resolves in about a millisecond, and reproducible every time
      // against production.
      //
      // Awaiting the request removes the guesswork: the branch below runs on an answer that
      // postdates the cookie, by construction rather than by timing. The `notify` above is given
      // the length of this round trip to settle every other subscriber, which is why it goes first.
      const { data: session } = await authClient.getSession();
      if (cancelled) return;

      if (session) {
        router.replace('/');
        return;
      }

      // Two different failures, and the difference is worth carrying. A link with no `cookie` on
      // it is one the server declined to honour — expired, or already used, which is what a link
      // tapped twice looks like; verified against production, where a spent token still redirects
      // here but with no `Set-Cookie` to pass along. A link that carried one and still left us
      // signed out is something else, and saying "expired" would be a guess dressed as an answer.
      router.replace({
        pathname: '/sign-in',
        params: { reason: cookie ? 'failed' : 'expired' },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [cookie, router]);

  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
