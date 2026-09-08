import { describe, expect, it } from "vitest";
import { passkeyLabel } from "@/lib/passkeys/label";

// From the AAGUID table in `@better-auth/passkey`. Real values, so this test also fails if an
// upgrade drops the mapping we now depend on for every unnamed credential.
const ONE_PASSWORD = "bada5566-a7aa-401f-bd96-45619a55120d";
const ANONYMOUS = "00000000-0000-0000-0000-000000000000";

describe("passkeyLabel", () => {
  it("prefers the name someone chose", () => {
    expect(passkeyLabel("Work laptop", ONE_PASSWORD)).toBe("Work laptop");
  });

  it("falls through a name that is only whitespace", () => {
    // A rename is validated, but a row written by an older client is not, and " " would otherwise
    // render as a blank row you cannot tell from any other blank row.
    expect(passkeyLabel("   ", ONE_PASSWORD)).toBe("1Password");
  });

  it("names the authenticator when nothing else is set", () => {
    expect(passkeyLabel(null, ONE_PASSWORD)).toBe("1Password");
  });

  it("does not guess at a platform that declined to identify itself", () => {
    expect(passkeyLabel(null, ANONYMOUS)).toBe("Passkey");
    expect(passkeyLabel(null, "not-an-aaguid")).toBe("Passkey");
  });

  it("survives a row with neither", () => {
    expect(passkeyLabel(null, null)).toBe("Passkey");
    expect(passkeyLabel(undefined, undefined)).toBe("Passkey");
  });
});
