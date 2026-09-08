import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveBaseUrl } from "@/lib/urls";

/**
 * What a registration ceremony calls the account.
 *
 * This exists because the field is invisible from inside the app. `user.name` in the WebAuthn
 * options never renders in our UI — it is the username the *authenticator* files the credential
 * under, so the only place a wrong value shows up is in 1Password or the iOS credential sheet,
 * weeks later, on somebody's phone.
 *
 * It was wrong. Better Auth spends one `name` option twice: in the verify-registration body it
 * sets our own `passkeys.name`, and on this request it becomes `user.name`
 * (`userName: ctx.query?.name || user.name || user.id`). Both clients passed a guess at the
 * device — "Mac", "iPhone 17 Pro" — so every passkey this app created was filed under a device
 * label instead of an email address, and the sign-in sheet offered three credentials that all
 * claimed to be the same thing.
 *
 * The fix is an absence: neither client sends `name` any more. An absence is exactly what a future
 * change re-adds without noticing, which is what this test is for.
 */
async function registrationOptions(
  token: string,
  query = "",
): Promise<Response> {
  return auth.handler(
    new Request(
      `${resolveBaseUrl()}/api/auth/passkey/generate-register-options${query}`,
      {
        method: "GET",
        // The session as a bearer token rather than a signed cookie. `bearer()` is in the plugin
        // list for the native app's sake and accepts an unsigned token, signing it itself — which
        // makes a session usable from a test without reproducing Better Auth's cookie signing.
        headers: { authorization: `Bearer ${token}` },
      },
    ),
  );
}

async function signedInUser(email: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email, name: "Test Person", emailVerified: true },
  });
  const token = randomUUID();
  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      // Comfortably inside `freshAge`: registration is guarded by `freshSessionMiddleware`, so a
      // session old enough to be stale would fail here for a reason unrelated to what is asserted.
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

describe("passkey registration options", () => {
  it("names the account, not the device", async () => {
    const token = await signedInUser("names-the-account@example.test");

    const response = await registrationOptions(token);

    expect(response.status).toBe(200);
    const options = await response.json();
    expect(options.user).toMatchObject({
      name: "names-the-account@example.test",
      displayName: "names-the-account@example.test",
    });
  });

  it("would be overwritten by a name, which is why neither client sends one", async () => {
    // Not a test of our code but of the library's behaviour underneath it: the whole reason the
    // clients pass nothing. If an upgrade ever separates the two meanings of `name`, this fails
    // and the comments in `app/account/passkey-controls.tsx` and `mobile/src/lib/passkey-client.ts`
    // can come out.
    const token = await signedInUser("overwritten@example.test");

    const response = await registrationOptions(token, "?name=Mac");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { name: "Mac" },
    });
  });
});
