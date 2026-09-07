import { env } from "@/lib/env/server";
import { ANDROID_PACKAGE_NAME } from "@/lib/native-app";

/**
 * The Digital Asset Links document, Android's counterpart to apple-app-site-association.
 *
 * `delegate_permission/common.get_login_creds` is the relation that matters here: without it,
 * Credential Manager reports "no matching credentials" rather than an error, which is a
 * particularly unhelpful way to learn the file is wrong.
 *
 * The fingerprints are SHA-256 hashes of the *signing certificates*, and there is usually more
 * than one — a debug key, an upload key, and the key Google Play re-signs with. Every certificate
 * that will ever sign a build the family installs has to appear here, or passkeys work on some
 * builds and not others. Get them from `eas credentials` (or `keytool -list -v -keystore ...`).
 *
 * Served from a route handler rather than `public/` so the fingerprints stay configuration rather
 * than a committed file that would differ per environment.
 */
export async function GET(): Promise<Response> {
  const fingerprints = parseFingerprints(env.ANDROID_CERT_FINGERPRINTS);

  // Nothing correct to say without at least one fingerprint, and an empty `sha256_cert_fingerprints`
  // is a document that actively asserts no app is authorised.
  if (fingerprints.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const body = [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}

/** Comma-separated colon-delimited hex, the shape `keytool` and `eas credentials` both print. */
function parseFingerprints(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
}
