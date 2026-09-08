import { beforeEach, describe, expect, it } from "vitest";
import { getPasskeys } from "@/lib/passkeys/data";
import { prisma } from "@/lib/prisma";

// From the AAGUID table in `@better-auth/passkey`.
const ONE_PASSWORD = "bada5566-a7aa-401f-bd96-45619a55120d";
const ANONYMOUS = "00000000-0000-0000-0000-000000000000";

let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: "passkeys@example.test", name: "Test Person" },
  });
  userId = user.id;
});

async function addPasskey(
  overrides: Partial<{
    name: string | null;
    aaguid: string | null;
    deviceType: string;
    createdAt: Date;
    userId: string;
  }> = {},
) {
  const { userId: owner = userId, ...rest } = overrides;
  await prisma.passkey.create({
    data: {
      userId: owner,
      name: null,
      aaguid: ONE_PASSWORD,
      deviceType: "multiDevice",
      createdAt: new Date("2026-01-01"),
      publicKey: "key",
      credentialID: crypto.randomUUID(),
      counter: 0,
      backedUp: true,
      transports: "internal",
      ...rest,
    },
  });
}

describe("getPasskeys", () => {
  it("names an unnamed credential after its authenticator", async () => {
    await addPasskey();

    const [passkey] = await getPasskeys(userId);

    expect(passkey.label).toBe("1Password");
  });

  it("prefers a name someone chose", async () => {
    await addPasskey({ name: "Work laptop" });

    const [passkey] = await getPasskeys(userId);

    expect(passkey.label).toBe("Work laptop");
  });

  it("falls back to 'Passkey' when the platform declined to identify itself", async () => {
    await addPasskey({ aaguid: ANONYMOUS });

    const [passkey] = await getPasskeys(userId);

    expect(passkey.label).toBe("Passkey");
  });

  it("returns only this account's passkeys", async () => {
    const other = await prisma.user.create({
      data: { email: "someone-else@example.test", name: "Someone Else" },
    });
    await addPasskey({ name: "Mine" });
    await addPasskey({ name: "Theirs", userId: other.id });

    const passkeys = await getPasskeys(userId);

    expect(passkeys.map((passkey) => passkey.label)).toEqual(["Mine"]);
  });

  it("orders oldest first, so adding one does not move the rows above it", async () => {
    await addPasskey({ name: "First", createdAt: new Date("2026-01-01") });
    await addPasskey({ name: "Second", createdAt: new Date("2026-06-01") });

    const passkeys = await getPasskeys(userId);

    expect(passkeys.map((passkey) => passkey.label)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("treats anything that is not single-device as synced", async () => {
    await addPasskey({ deviceType: "singleDevice" });

    const [single] = await getPasskeys(userId);
    expect(single.deviceType).toBe("singleDevice");

    await prisma.passkey.deleteMany({ where: { userId } });
    await addPasskey({ deviceType: "something-new" });

    const [unknown] = await getPasskeys(userId);
    expect(unknown.deviceType).toBe("multiDevice");
  });

  it("never loads the public key", async () => {
    await addPasskey();

    const [passkey] = await getPasskeys(userId);

    expect(passkey).not.toHaveProperty("publicKey");
  });
});
