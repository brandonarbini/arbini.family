import * as Device from 'expo-device';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Page } from '@/components/page';
import { Copy, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient, passkeysSupported } from '@/lib/auth-client';

type Status = 'idle' | 'adding' | 'added' | 'error';

/**
 * What this passkey is called in the list at arbini.family/account.
 *
 * The name is the only way to tell two credentials apart once they are in the list — there is
 * nothing else on screen but a date — so it is worth more than "This phone", which is true of
 * every phone and useful on none of them. The web's own `deviceLabel()` in
 * app/account/passkey-controls.tsx has to guess from a user-agent string and gets no further than
 * "iPhone or iPad"; here the device will simply say.
 *
 * `modelName` rather than `deviceName`: since iOS 16 the user-assigned name ("Brandon's iPhone")
 * is gated behind an entitlement Apple grants case by case, and without it `deviceName` returns
 * the model anyway — via an API that reads like it returns something better.
 */
function passkeyName(): string {
  return Device.modelName ?? 'iPhone';
}

/**
 * Account: add a passkey to this device, and sign out.
 *
 * The counterpart of the web's `/account`. Registering has to happen somewhere you are *already*
 * signed in — a passkey is bound to an existing identity, not a way to claim one — which is why
 * this lives behind the tabs rather than next to the sign-in screen.
 */
export default function AccountScreen() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function addPasskey() {
    setStatus('adding');
    setError(null);

    const name = passkeyName();
    const result = await authClient.passkey.addPasskey({ name });

    if (result?.error) {
      // Cancelling is not a failure. The sheet was dismissed on purpose, and an error where an
      // answer was expected reads as a bug in the app rather than as the thing that just happened.
      // `code` is only on the errors this app raises from the native call; a failure from the
      // server arrives as a plain `{ message?, status }`. The `in` check is what tells them apart.
      if ('code' in result.error && result.error.code === 'AUTH_CANCELLED') {
        setStatus('idle');
        return;
      }

      // Say what went wrong, when there is something to say.
      //
      // This used to be one fixed sentence, on the reasoning that the causes — a missing
      // entitlement, an association document the platform could not fetch — were nothing the
      // person holding the phone could act on. That was true of the module this replaced, which
      // reported every outcome as "auth cancelled". It is not true now: react-native-passkeys
      // distinguishes a dismissed sheet from disabled biometrics from a misconfigured
      // apple-app-site-association, and two of those three are things you can actually go and fix.
      // Throwing that away to keep the copy tidy is how "could not add a passkey" ends up being
      // the only thing anyone ever learns.
      console.warn('[account] addPasskey failed', result.error);
      setStatus('error');
      setError(
        result.error.message
          ? `Could not add a passkey: ${result.error.message}`
          : 'Could not add a passkey on this device. The email link still works.',
      );
      return;
    }

    setStatus('added');
  }

  return (
    <Page dateline={session?.user?.name ?? 'Account'}>
      <Section title="Signed in as">
        <Copy>{session?.user?.name ?? '—'}</Copy>
        <Copy muted style={styles.email}>
          {session?.user?.email ?? ''}
        </Copy>
      </Section>

      <Section title="Passkey">
        {!passkeysSupported ? (
          <Copy muted>
            This build cannot add passkeys — it has no credential module. A development or release
            build can.
          </Copy>
        ) : status === 'added' ? (
          // Naming it back is not decoration: it is the string that will identify this credential
          // on the website, and the only moment anyone can connect the two.
          <Copy>Added as “{passkeyName()}”. Face ID will sign you in from now on.</Copy>
        ) : (
          <>
            <Copy muted>
              A passkey replaces the emailed link with Face ID. It is stored on this device and in
              your iCloud Keychain, and works on the website too.
            </Copy>
            {error ? (
              <Copy style={[styles.error, { color: theme.destructive }]}>{error}</Copy>
            ) : null}
            <Pressable
              onPress={addPasskey}
              disabled={status === 'adding'}
              style={({ pressed }) => [
                styles.button,
                { borderColor: theme.text, opacity: status === 'adding' ? 0.4 : pressed ? 0.6 : 1 },
              ]}
            >
              {status === 'adding' ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <Text style={[styles.buttonLabel, { color: theme.text }]}>ADD A PASSKEY</Text>
              )}
            </Pressable>
          </>
        )}
      </Section>

      <Section title="Leaving">
        <Pressable onPress={() => authClient.signOut()}>
          <Text style={[styles.signOut, { color: theme.primary }]}>Sign out</Text>
        </Pressable>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  email: {
    fontSize: 14,
  },
  error: {
    marginTop: Spacing.two,
    fontSize: 14,
  },
  button: {
    marginTop: Spacing.three,
    borderRadius: Radius,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
  signOut: {
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
});
