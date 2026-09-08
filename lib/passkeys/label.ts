import { getAuthenticatorName } from "@better-auth/passkey";

/**
 * What to call a passkey in a list.
 *
 * Three sources, in descending order of how much they know:
 *
 * 1. What you called it. Only ever set by a rename — nothing names a passkey at registration, and
 *    deliberately so. See the note in `app/account/passkey-controls.tsx`.
 * 2. What it is. Every authenticator reports an AAGUID identifying its make, and Better Auth ships
 *    the community mapping from the passkeydeveloper list, so an unnamed credential can still say
 *    "1Password" or "iCloud Keychain". That is the useful fact when deciding which row to delete —
 *    a passkey is a thing that lives somewhere, and where it lives is what you actually recognise.
 * 3. Nothing. Privacy-preserving platforms report the all-zero AAGUID, which `getAuthenticatorName`
 *    correctly declines to guess at.
 *
 * Called on the server only, and once: `getPasskeys` in ./data.ts resolves the label before anyone
 * sees a row, so the web page and `/api/v1/passkeys` render the same string and the phone never
 * has to know an AAGUID exists. That is deliberate — a mapping that lives in two places is a
 * mapping that disagrees with itself the first time one side upgrades.
 */
export function passkeyLabel(
  name: string | null | undefined,
  aaguid: string | null | undefined,
): string {
  return name?.trim() || getAuthenticatorName(aaguid) || "Passkey";
}
