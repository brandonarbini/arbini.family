import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { APP_URL_SCHEME } from "@/lib/native-app";
import { resolveBaseUrl } from "@/lib/urls";

/**
 * The origin check, from the native app's side of it.
 *
 * This exists because `trustedOrigins` was wrong in a way no other test could see. It read
 * `arbinifamily://auth`, which looks like a path but is an *authority* to Better Auth's
 * custom-scheme parser, and the app identifies itself as `arbinifamily:///` — empty authority. So
 * every request the phone made came back 403 INVALID_ORIGIN, while the identical string passed as
 * a `callbackURL` matched fine. Reviewing the callback proved nothing about the origin.
 *
 * The request built here is the one `@better-auth/expo` actually sends: no `Origin` header,
 * because a native fetch has no origin to send, and an `expo-origin` header that the `expo()`
 * plugin promotes to `Origin` before the check runs.
 *
 * The address is deliberately outside the family allowlist. `sendMagicLink` declines to post to an
 * unknown address but still answers 200, so this exercises the whole middleware chain without
 * sending mail — and a 200 here means the origin was accepted, not that an account exists.
 */
async function signInFromApp(expoOrigin: string): Promise<Response> {
  return auth.handler(
    new Request(`${resolveBaseUrl()}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "expo-origin": expoOrigin,
      },
      body: JSON.stringify({
        email: "not-in-the-family@example.test",
        callbackURL: `${APP_URL_SCHEME}://auth`,
      }),
    }),
  );
}

describe("trustedOrigins", () => {
  it("accepts the origin the Expo client sends", async () => {
    // `Linking.createURL("", { scheme })` in a standalone build — three slashes, empty authority.
    const response = await signInFromApp(`${APP_URL_SCHEME}:///`);

    expect(response.status).toBe(200);
  });

  it("accepts the scheme without a trailing slash", async () => {
    // Expo Go and older clients produce this shape instead. Both must work; neither is worth
    // discovering on a phone.
    const response = await signInFromApp(`${APP_URL_SCHEME}://`);

    expect(response.status).toBe(200);
  });

  it("still rejects an origin that is not the app", async () => {
    const response = await signInFromApp("https://evil.example");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_ORIGIN",
    });
  });
});
