/**
 * Facts about the native app that the web app also has to know.
 *
 * These values live in `mobile/app.json` as far as the app is concerned, but the server has to
 * agree with them: it serves the association documents that authorise the app, and those name the
 * app by identifier. Two copies of a string in two languages is exactly the arrangement that
 * drifts, so the server's copy is here, in one place, next to a note saying what it must match.
 */

/** Must equal `expo.ios.bundleIdentifier` in mobile/app.json. */
export const IOS_BUNDLE_IDENTIFIER = "family.arbini.app";

/** Must equal `expo.android.package` in mobile/app.json. */
export const ANDROID_PACKAGE_NAME = "family.arbini.app";

/**
 * Must equal `expo.scheme` in mobile/app.json, and the authority of the `trustedOrigins` entry in
 * lib/auth.ts.
 */
export const APP_URL_SCHEME = "arbinifamily";
