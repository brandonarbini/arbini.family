/**
 * Facts about the native app that the web app also has to know.
 *
 * These values live in `mobile/app.json` as far as the app is concerned, but the server has to
 * agree with them: it serves the association documents that authorise the app, and those name the
 * app by identifier. Two copies of a string in two languages is exactly the arrangement that
 * drifts, so the server's copy is here, in one place, next to a note saying what it must match.
 */

/**
 * The Apple Developer Team ID.
 *
 * A constant rather than an environment variable, because it does not vary: it is one value for
 * the account, identical in development, preview and production, and it changes only if the whole
 * app moves to a different Apple team. Configuration is what differs between environments; this
 * does not.
 *
 * Not a secret either. It is published in the apple-app-site-association document below, which
 * Apple's servers fetch and anybody can read.
 *
 * Keeping it here rather than in `.env.local` also removes a quiet failure: that file is
 * gitignored, so a fresh clone would have built an app with no associated domain and no passkeys,
 * and nothing would have said why.
 */
export const APPLE_TEAM_ID = "APYRBMRLK3";

/** Must equal `expo.ios.bundleIdentifier` in mobile/app.json. */
export const IOS_BUNDLE_IDENTIFIER = "family.arbini.app";

/** Must equal `expo.android.package` in mobile/app.json. */
export const ANDROID_PACKAGE_NAME = "family.arbini.app";

/**
 * Must equal `expo.scheme` in mobile/app.json and `APP_URL_SCHEME` in
 * mobile/src/lib/auth-client.ts. lib/auth.ts builds the `trustedOrigins` entry from it.
 */
export const APP_URL_SCHEME = "arbinifamily";
