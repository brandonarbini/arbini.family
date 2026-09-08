import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PasskeyDto } from '@server/api/v1/dto';

import { Page } from '@/components/page';
import { Copy, RuledList, Section } from '@/components/section';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient, passkeysSupported } from '@/lib/auth-client';
import {
  useDeletePasskey,
  useInvalidatePasskeys,
  usePasskeys,
  useRenamePasskey,
} from '@/lib/queries';

type Status = 'idle' | 'adding' | 'error';

/**
 * Account: the passkeys on this account, and sign out.
 *
 * The counterpart of the web's `/account`, and the same list — one credential can be reached from
 * the phone and the website both, because `rpID` is the hostname either way. Registering has to
 * happen somewhere you are *already* signed in — a passkey is bound to an existing identity, not a
 * way to claim one — which is why this lives behind the tabs rather than next to the sign-in
 * screen.
 */
export default function AccountScreen() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const passkeys = usePasskeys();
  const invalidatePasskeys = useInvalidatePasskeys();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function addPasskey() {
    setStatus('adding');
    setError(null);

    // No name. See the note on the register-options request in `lib/passkey-client.ts`: the one
    // Better Auth calls `name` is also WebAuthn's `user.name`, and a device label sent there is
    // what files this credential in iCloud Keychain under "iPhone 17 Pro" instead of under your
    // email address. Unnamed rows are named after their authenticator by the server — see
    // `lib/passkeys/label.ts` on the web — and the row below renames.
    const result = await authClient.passkey.addPasskey();

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

    setStatus('idle');
    await invalidatePasskeys();
  }

  return (
    <Page dateline={session?.user?.name ?? 'Account'}>
      <Section title="Signed in as">
        <Copy>{session?.user?.name ?? '—'}</Copy>
        <Copy muted style={styles.email}>
          {session?.user?.email ?? ''}
        </Copy>
      </Section>

      <Section title="Passkeys">
        {!passkeysSupported ? (
          <Copy muted>
            This build cannot add passkeys — it has no credential module. A development or release
            build can.
          </Copy>
        ) : (
          <>
            <Copy muted>
              A passkey replaces the emailed link with Face ID. It is stored on this device and in
              your iCloud Keychain, and works on the website too.
            </Copy>

            {passkeys.isPending ? (
              <ActivityIndicator style={styles.listSpinner} color={theme.textSecondary} />
            ) : passkeys.isError ? (
              <Copy style={[styles.error, { color: theme.destructive }]}>
                Could not load your passkeys.
              </Copy>
            ) : passkeys.data.length > 0 ? (
              <View style={styles.list}>
                <RuledList>
                  {passkeys.data.map((passkey) => (
                    <PasskeyRow key={passkey.id} passkey={passkey} />
                  ))}
                </RuledList>
              </View>
            ) : null}

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

/**
 * One passkey: what it is called, and the two things you can do to it.
 *
 * Renaming is the field itself rather than a button that reveals a field. There is one editable
 * thing on the row and no room on a phone for a mode switch to announce it, so the label *is* the
 * input, styled as text until you touch it. It commits on blur and on return, both of which are
 * ways of saying "done" that iOS already teaches.
 */
function PasskeyRow({ passkey }: { passkey: PasskeyDto }) {
  const theme = useTheme();
  const rename = useRenamePasskey();
  const remove = useDeletePasskey();

  // Already resolved by the server — an unnamed credential arrives called after the authenticator
  // it lives in. See `PasskeyDto`.
  const label = passkey.label;
  const [draft, setDraft] = useState(label);

  // The field holds a draft, so it has to be told when the truth underneath it moves — a rename on
  // the website, or a refetch on focus, would otherwise leave this row showing a name that is no
  // longer anybody's. Adjusting during render rather than in an effect is React's own answer to
  // this: it re-renders before painting, so the stale value is never on screen.
  const [lastLabel, setLastLabel] = useState(label);
  if (label !== lastLabel) {
    setLastLabel(label);
    setDraft(label);
  }

  function commit() {
    const name = draft.trim();
    // An empty field is not a way to clear the name — it is a slip. Put the label back.
    if (!name || name === label) {
      setDraft(label);
      return;
    }
    // On failure the field goes back to what the server still believes. A row left showing a name
    // that was never saved is worse than one that visibly did not change.
    rename.mutate({ id: passkey.id, name }, { onError: () => setDraft(label) });
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          editable={!rename.isPending}
          maxLength={60}
          returnKeyType="done"
          selectTextOnFocus
          accessibilityLabel={`Name of the ${label} passkey`}
          style={[styles.name, { color: theme.text }]}
        />
        <Copy muted style={styles.subtitle}>
          {passkey.deviceType === 'singleDevice'
            ? 'This device only'
            : 'Synced across your devices'}
        </Copy>
      </View>

      {rename.isPending || remove.isPending ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : (
        <Pressable
          onPress={() => remove.mutate(passkey.id)}
          accessibilityLabel={`Remove the ${label} passkey`}
          hitSlop={Spacing.two}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[styles.remove, { color: theme.destructive }]}>REMOVE</Text>
        </Pressable>
      )}
    </View>
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
  list: {
    marginTop: Spacing.three,
  },
  listSpinner: {
    marginTop: Spacing.three,
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
  // The input carries no border and no background: at rest it has to read as the row's title, not
  // as a form control sitting in a list of them.
  name: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
  },
  subtitle: {
    fontSize: 14,
  },
  remove: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
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
