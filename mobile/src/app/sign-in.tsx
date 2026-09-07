import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Page } from '@/components/page';
import { Copy, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Sign-in by emailed link, the native counterpart of `app/signin/signin-form.tsx`.
 *
 * It inherits that component's one governing rule: **the outcome shown must not depend on whether
 * the address belongs to the family.** `sendMagicLink` in lib/auth.ts declines to send to an
 * unknown address but still returns success, precisely so the response cannot be used to test who
 * is in the family. A screen that said "no such account" would hand that back. So there is one
 * "check your email" state, reached whenever the request itself succeeded.
 *
 * No passkey button. Passkeys are WebAuthn, which needs `navigator.credentials` — absent in React
 * Native. Adding them here means a native module plus associated-domains setup; until then the
 * long session lifetime in lib/auth.ts is what keeps this screen rare.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function requestMagicLink() {
    Keyboard.dismiss();
    setStatus('sending');
    setError(null);

    const { error: requestError } = await authClient.signIn.magicLink({
      email: email.trim(),
      // Where the link comes back to. Validated server-side against `trustedOrigins`, so this
      // string has to match the entry in lib/auth.ts exactly.
      callbackURL: 'arbinifamily://auth',
    });

    if (requestError) {
      // Only transport and rate-limit failures reach here — never "no such user", because the
      // server does not distinguish. Rate limiting is the one a family member will actually hit.
      setStatus('error');
      setError(
        requestError.status === 429
          ? 'Too many attempts. Wait a few minutes and try again.'
          : 'Something went wrong. Try again.',
      );
      return;
    }

    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <Page dateline="Sign in">
        <Section title="Check your email">
          <Copy>
            If that address is one of ours, a sign-in link is on its way. It works once and expires
            in ten minutes.
          </Copy>
          <Pressable onPress={() => setStatus('idle')} style={styles.linkButton}>
            <Text style={[styles.link, { color: theme.primary }]}>Use a different address</Text>
          </Pressable>
        </Section>
      </Page>
    );
  }

  const busy = status === 'sending';

  return (
    <Page dateline="Sign in">
      <Section title="Sign in">
        <Copy muted>A link to this address signs you in. There is no password.</Copy>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@arbini.com"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          returnKeyType="go"
          editable={!busy}
          onSubmitEditing={requestMagicLink}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />

        {error ? (
          <Copy style={[styles.error, { color: theme.destructive }]}>{error}</Copy>
        ) : null}

        <Pressable
          onPress={requestMagicLink}
          disabled={busy || email.trim().length === 0}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.text,
              opacity: busy || email.trim().length === 0 ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={[styles.buttonLabel, { color: theme.background }]}>SEND THE LINK</Text>
          )}
        </Pressable>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.serif,
    fontSize: 17,
  },
  error: {
    marginTop: Spacing.two,
    fontSize: 14,
  },
  button: {
    marginTop: Spacing.three,
    borderRadius: Radius,
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
  linkButton: {
    marginTop: Spacing.three,
  },
  link: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
