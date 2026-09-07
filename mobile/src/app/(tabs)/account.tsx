import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Page } from '@/components/page';
import { Copy, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

type Status = 'idle' | 'adding' | 'added' | 'error';

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

    const result = await authClient.passkey.addPasskey({ name: 'This phone' });

    if (result?.error) {
      setStatus('error');
      setError(
        // The overwhelmingly likely causes are a build without the associated-domain entitlement
        // or an association document the platform could not fetch — neither of which the person
        // holding the phone can do anything about, so the message does not pretend otherwise.
        'Could not add a passkey on this device. The email link still works.',
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
        {status === 'added' ? (
          <Copy>Added. Face ID will sign you in from now on.</Copy>
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
