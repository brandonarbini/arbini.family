import type { Passkey } from '@better-auth/passkey';
import { getPasskeyActions, passkeyClient } from '@better-auth/passkey/client';
import type { Session, User } from 'better-auth';
import type { BetterFetch, BetterFetchOption } from 'better-auth/client';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { atom } from 'nanostores';

/**
 * Passkeys on the device, as a Better Auth client plugin.
 *
 * `passkeyClient()` speaks WebAuthn through `navigator.credentials`, which React Native does not
 * have. Everything *else* about it is right — the endpoints, the payload shapes, the type
 * inference — so this spreads it and replaces only the two calls that touch the authenticator.
 * The server needs no knowledge of any of this: `passkey()` in the web app's lib/auth.ts speaks
 * the WebAuthn protocol, and only the thing producing the attestation differs.
 *
 * **Why this file exists rather than a package.** It replaced
 * `@lobehub/expo-better-auth-passkey`, which did the same job and crashed the app on both of its
 * buttons: it declared its native entry points as plain `AsyncFunction`s, so Expo ran them on a
 * background queue, and they called `ASAuthorizationController.performRequests()` — UIKit,
 * main-thread-only. That was a process death, uncatchable from here. It was last published in June
 * 2026, its `latest` tag points at a version two minors behind what is on npm, and both carry the
 * bug. `react-native-passkeys` gets the same call right (`.runOnQueue(.main)` on both entry
 * points), so the native half is somebody else's job again and this file is the small, boring
 * half: fetch options, hand them to the authenticator, post the response back.
 *
 * The division of labour is the point. Everything below is a payload being moved from one place to
 * another, in a language where a mistake is a type error rather than a crash.
 */

/** What the two `react-native-passkeys` calls we use look like. */
type PasskeyModule = {
  isSupported: () => boolean;
  create: (
    request: PublicKeyCredentialCreationOptionsJSON,
  ) => Promise<RegistrationResponseJSON | null>;
  get: (
    request: PublicKeyCredentialRequestOptionsJSON,
  ) => Promise<AuthenticationResponseJSON | null>;
};

/**
 * Loaded lazily, and the failure caught, for the reason the old client documented and which has
 * not changed: an Expo module throws `Cannot find native module` at *import* time when the binary
 * does not contain it. A static import does not degrade the passkey button in that case — it stops
 * the app booting at all, before a single screen renders. `pnpm ios` builds a dev client so this
 * should never miss, but "should never" is not a thing to bet the launch screen on.
 */
function loadPasskeys(): PasskeyModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-passkeys') as PasskeyModule;
  } catch {
    return null;
  }
}

const native = loadPasskeys();

/**
 * Whether this build can actually use passkeys.
 *
 * Two different questions, and both have to be yes: the module has to be *in the binary* (a
 * property of the build, not of the source in front of you), and the OS has to support passkeys at
 * all. The UI consults this so it can decline to offer something that cannot work.
 */
export const passkeysSupported = native?.isSupported() ?? false;

/** The shape better-auth infers its client types from. */
type BasePasskeyClient = ReturnType<typeof passkeyClient>;
type PasskeyActions = ReturnType<BasePasskeyClient['getActions']>;

/**
 * The transports iOS will accept, from `AuthenticatorTransport` in the native module.
 *
 * Better Auth stores a credential's transports as one comma-joined string, so a row that never
 * recorded any splits back to `[""]` — an array containing an empty string rather than an empty
 * array. That reaches `excludeCredentials[].transports` verbatim, and the native module, which
 * types the field as a real enum, rejects the whole options object:
 *
 *     EnumNoSuchValueException: '' is not present in AuthenticatorTransport enum
 *
 * The failure surfaces as "the 1st argument cannot be cast to PublicKeyCredentialCreationOptions",
 * four `Caused by` levels above the empty string that actually caused it, and it only appears once
 * an account has passkeys to exclude — so it waits until the second registration to show up. The
 * module this replaced accepted it because it read these fields loosely and never looked.
 *
 * Filtering here rather than fixing the rows: the rows can be cleaned and should be, but this is
 * the boundary where a wrong value becomes a crash-shaped error, and it is the boundary that has
 * to hold for any row written by any client, including ones written before today.
 */
const TRANSPORTS = ['ble', 'hybrid', 'nfc', 'usb', 'internal', 'smart-card'] as const;

type Descriptor = { transports?: string[] };

/**
 * Drops transports the authenticator would refuse, and the key entirely when nothing survives —
 * `undefined` is a valid absence to the native module in a way that `[]` need not be.
 */
function withUsableTransports<T extends Descriptor>(descriptors: T[] | undefined): T[] | undefined {
  return descriptors?.map((descriptor) => {
    const transports = descriptor.transports?.filter((t) =>
      (TRANSPORTS as readonly string[]).includes(t),
    );
    return { ...descriptor, transports: transports?.length ? transports : undefined };
  });
}

/**
 * A cancelled sheet is not an error worth a stack trace — somebody pressed Cancel, or had no
 * credential for this site. `react-native-passkeys` reports both by resolving `null`, and rejects
 * only for genuine faults, so the two are kept distinct here rather than flattened into one
 * "didn't work".
 */
const CANCELLED = {
  data: null,
  error: {
    code: 'AUTH_CANCELLED',
    message: 'auth cancelled',
    status: 400,
    statusText: 'BAD_REQUEST',
  },
} as const;

function failed(error: unknown) {
  return {
    data: null,
    error: {
      code: 'AUTH_FAILED',
      message: error instanceof Error ? error.message : 'passkey failed',
      status: 400,
      statusText: 'BAD_REQUEST',
    },
  } as const;
}

function nativeActions($fetch: BetterFetch, $store: { notify: (signal: string) => void }) {
  return {
    signIn: {
      /**
       * No email argument, and none is wanted: the platform sheet lists whichever credentials are
       * registered for this domain on this device, so asking who you are first would be asking a
       * question the phone can already answer.
       */
      passkey: async (_opts?: { autoFill?: boolean }, fetchOptions?: BetterFetchOption) => {
        if (!native) return failed(new Error('This build has no passkey module.'));

        const options = await $fetch<PublicKeyCredentialRequestOptionsJSON>(
          '/passkey/generate-authenticate-options',
          { method: 'GET', throw: false },
        );
        if (!options.data) return options;

        let assertion: AuthenticationResponseJSON | null;
        try {
          // `allowCredentials` is empty today — the server offers a discoverable credential rather
          // than naming one — but it carries the same descriptors, so it gets the same treatment
          // rather than waiting to fail the same way.
          assertion = await native.get({
            ...options.data,
            allowCredentials: withUsableTransports(options.data.allowCredentials),
          });
        } catch (error) {
          return failed(error);
        }
        if (!assertion) return CANCELLED;

        const verified = await $fetch<{ session: Session; user: User }>(
          '/passkey/verify-authentication',
          { ...fetchOptions, body: { response: assertion }, method: 'POST', throw: false },
        );
        // The session cookie arrives on this response and `@better-auth/expo` stores it, but
        // nothing has told the session atom to look again.
        $store.notify('$sessionSignal');
        return verified;
      },
    },

    passkey: {
      /**
       * Registering has to happen somewhere you are *already* signed in — a passkey is bound to an
       * existing identity, not a way to claim one — so the options request carries the session.
       */
      addPasskey: async (
        opts?: { name?: string; authenticatorAttachment?: 'platform' | 'cross-platform' },
        fetchOptions?: BetterFetchOption,
      ) => {
        if (!native) return failed(new Error('This build has no passkey module.'));

        // `name` is deliberately *not* in the query. Better Auth spends that one option twice:
        // in the verify-registration body below it sets our own `passkeys.name`, but on this
        // request it becomes WebAuthn's `user.name` — the account identifier the authenticator
        // stores and shows as the username. Sending a device label here is how the credential
        // ends up filed in iCloud Keychain under "iPhone 17 Pro" instead of under an email
        // address. Omitted, the plugin falls back to the session's email, which is the right
        // answer. Nothing passes a name today; keeping the two apart means nothing can start to
        // by accident. The web has no equivalent seam — `passkeyClient()` builds this request
        // itself — so `app/account/passkey-controls.tsx` simply passes no name at all.
        const options = await $fetch<PublicKeyCredentialCreationOptionsJSON>(
          '/passkey/generate-register-options',
          {
            method: 'GET',
            query: {
              ...(opts?.authenticatorAttachment && {
                authenticatorAttachment: opts.authenticatorAttachment,
              }),
            },
            throw: false,
          },
        );
        if (!options.data) return options;

        let attestation: RegistrationResponseJSON | null;
        try {
          attestation = await native.create({
            ...options.data,
            excludeCredentials: withUsableTransports(options.data.excludeCredentials),
          });
        } catch (error) {
          return failed(error);
        }
        if (!attestation) return CANCELLED;

        return await $fetch<{ passkey: Passkey }>('/passkey/verify-registration', {
          ...fetchOptions,
          body: { response: attestation, name: opts?.name },
          method: 'POST',
          throw: false,
        });
      },
    },
  };
}

/**
 * The plugin, with the web implementation kept for `expo start --web`.
 *
 * The cast is the one soft spot, and it is inherited rather than invented: the native actions
 * cover the device-meaningful subset of the web ones — no `returnWebAuthnResponse`, no
 * `extensions`, no `deletePasskey` — so if `@better-auth/passkey` grows an action, this will not
 * have it and tsc will not say so. `src/lib/auth-client.ts` names the three calls the app actually
 * makes, which is the list worth checking against on an upgrade.
 */
export const expoPasskeyClient = (): BasePasskeyClient => {
  const base = passkeyClient();
  const $listPasskeys = atom<number>(0);

  return {
    ...base,
    getActions: ($fetch, $store) =>
      native
        ? (nativeActions($fetch, $store) as unknown as PasskeyActions)
        : getPasskeyActions($fetch, { $listPasskeys, $store }),
  };
};
