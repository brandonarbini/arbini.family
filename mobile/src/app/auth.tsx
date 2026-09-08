import { getSetCookie } from '@better-auth/expo/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
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
  const { data: session, isPending } = authClient.useSession();
  const [settled, setSettled] = useState(false);

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

      // Better-auth's own "ask again" signal. `useSession()` fired its request when this screen
      // mounted — before the cookie existed — so without this it would sit on a null answer it
      // has no reason to revisit.
      authClient.$store.notify('$sessionSignal');
      setSettled(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [cookie]);

  useEffect(() => {
    if (!settled || isPending) return;
    // No session means the link was expired, already used, or tampered with. There is nothing to
    // say about the difference that the sign-in screen does not say better.
    router.replace(session ? '/' : '/sign-in');
  }, [settled, isPending, session, router]);

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
