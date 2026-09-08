import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config layered over app.json, for the one thing app.json cannot express: a comment.
 *
 * `webcredentials` is the associated-domain service that gates passkeys. Two things follow from
 * declaring it, and both are worth knowing before a build fails:
 *
 * - It is a *capability*, so Xcode will not build a target carrying it without a provisioning
 *   profile that grants it — and that requirement ignores the destination. Without a signing
 *   certificate, `npx expo run:ios` fails with "No code signing certificates are available to use"
 *   even for a simulator build, which reads as a broken toolchain rather than the missing account
 *   it actually is. Create one in Xcode: Settings → Accounts → Manage Certificates → + → Apple
 *   Development.
 * - The domain must equal `rpID` on the server — the hostname of `resolveBaseUrl()` — and it must
 *   serve `/.well-known/apple-app-site-association` over HTTPS. Apple's servers fetch that
 *   document; a mismatch means the platform finds no credentials and says nothing.
 *
 * This was briefly gated on an `EXPO_APPLE_TEAM_ID` environment variable, so the app could be
 * built without an Apple account. That gate is gone: the variable lived in a gitignored file, so a
 * fresh clone would have built an app with no associated domain and no passkeys, and nothing would
 * have said why. A build failure naming the missing certificate is the better failure.
 */
const PASSKEY_DOMAIN = 'arbini.family';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Arbini Family',
  slug: config.slug ?? 'arbini-family-mobile',
  ios: {
    ...config.ios,
    associatedDomains: [`webcredentials:${PASSKEY_DOMAIN}`],
  },
});
