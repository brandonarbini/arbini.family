import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authClient } from '@/lib/auth-client';
import { QueryProvider } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

/**
 * The root layout is a Stack rather than the tab navigator itself: sign-in has to render outside
 * the tabs, and putting NativeTabs at the root would leave nowhere for it to go.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  // Navigation's own theme, so screen backgrounds and push transitions use the paper ground
  // instead of React Navigation's default white/black.
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <QueryProvider>
        <AuthGate />
      </QueryProvider>
    </ThemeProvider>
  );
}

/**
 * Sends you to sign-in when there is no session, and out of it when one arrives.
 *
 * The redirect lives in an effect rather than in a conditional render because the router cannot
 * be navigated during render. `isPending` is the state that matters most here: the session is read
 * from the keychain asynchronously at launch, so treating "not loaded yet" as "signed out" would
 * flash the sign-in screen at somebody who is already signed in, every single cold start.
 */
function AuthGate() {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  // Both screens are reachable without a session, and for the same reason: /auth is where the
  // emailed link lands, arrived at in the instant *before* the session exists. Redirecting away
  // from it would cancel the sign-in it is in the middle of completing.
  const onSignIn = segments[0] === 'sign-in';
  const onAuthCallback = segments[0] === 'auth';
  const outsideTheApp = onSignIn || onAuthCallback;

  useEffect(() => {
    if (isPending) return;

    if (!session && !outsideTheApp) {
      router.replace('/sign-in');
    } else if (session && onSignIn) {
      // Deliberately `onSignIn`, not `outsideTheApp`: /auth performs its own redirect once the
      // session lands, and racing it from here would mean two navigations for one arrival.
      router.replace('/');
    }
  }, [isPending, session, outsideTheApp, onSignIn, router]);

  useEffect(() => {
    // Held until the session has been read, so the first frame the family sees is the board or
    // the sign-in screen — never a flash of one on the way to the other.
    if (!isPending) SplashScreen.hideAsync();
  }, [isPending]);

  if (isPending) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      <Stack.Screen name="auth" options={{ animation: 'none' }} />
    </Stack>
  );
}
