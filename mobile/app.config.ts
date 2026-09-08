import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config layered over app.json.
 *
 * It exists for one decision: whether to declare the associated domain.
 *
 * `com.apple.developer.associated-domains` is a capability, and Xcode will not build a target
 * carrying it without a provisioning profile that grants it — which needs an Apple Developer
 * account. That requirement does not care that the destination is a simulator: with the
 * entitlement present, `expo run:ios` fails with "No code signing certificates are available"
 * even for a simulator build, which reads as a toolchain problem rather than as the missing
 * account it actually is.
 *
 * So the domain is declared only when `EXPO_APPLE_TEAM_ID` is set. Without an account the app
 * still builds and runs, and everything except passkeys works — the magic-link deep link uses the
 * custom URL scheme, which is not a capability and needs no entitlement at all. With an account,
 * set the variable and passkeys light up.
 *
 * The value must match `rpID` on the server: the hostname of `resolveBaseUrl()`.
 */
const PASSKEY_DOMAIN = 'arbini.family';

export default ({ config }: ConfigContext): ExpoConfig => {
  const appleTeamId = process.env.EXPO_APPLE_TEAM_ID;

  return {
    ...config,
    name: config.name ?? 'Arbini Family',
    slug: config.slug ?? 'arbini-family-mobile',
    ios: {
      ...config.ios,
      ...(appleTeamId ? { associatedDomains: [`webcredentials:${PASSKEY_DOMAIN}`] } : {}),
    },
  };
};
