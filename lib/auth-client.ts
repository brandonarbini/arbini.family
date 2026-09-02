"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The single client-side seam onto Better Auth. `better-auth/react` stays an implementation
 * detail of this module — no other `"use client"` file imports it directly, so the plugin list
 * cannot drift between call sites.
 *
 * No `baseURL`: the client is same-origin, and hardcoding one would break preview deployments,
 * which each get their own.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), passkeyClient()],
});

export const { signIn, signOut, useSession } = authClient;
