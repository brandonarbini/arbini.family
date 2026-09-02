import { describe, expect, it } from "vitest";
import { FamilyRole } from "@/generated/prisma/enums";
import { canEditProfile } from "@/lib/board/permissions";

const parent = { profileId: "parent-1", role: FamilyRole.PARENT };
const kid = { profileId: "kid-1", role: FamilyRole.KID };

describe("canEditProfile", () => {
  it("lets anyone edit their own stays", () => {
    expect(canEditProfile(kid, "kid-1")).toBe(true);
    expect(canEditProfile(parent, "parent-1")).toBe(true);
  });

  it("lets a parent edit anyone's", () => {
    expect(canEditProfile(parent, "kid-1")).toBe(true);
    expect(canEditProfile(parent, "someone-else")).toBe(true);
  });

  it("stops a kid editing someone else's", () => {
    // The rule the whole editor rests on. `/home/where` hides other people's stays from a kid,
    // but that is presentation — the profile id travels in a form field anyone can change, so
    // this is the check that actually holds.
    expect(canEditProfile(kid, "parent-1")).toBe(false);
    expect(canEditProfile(kid, "kid-2")).toBe(false);
  });

  it("stops a kid editing a stay whose owner is unknown", () => {
    expect(canEditProfile(kid, "")).toBe(false);
  });

  it("grants nothing to an actor with no profile", () => {
    // A signed-in account that was never seeded. Treated as "no permissions" rather than as an
    // error, so a half-set-up account cannot rewrite the board.
    expect(canEditProfile({ profileId: null, role: null }, "kid-1")).toBe(
      false,
    );
    expect(
      canEditProfile({ profileId: null, role: FamilyRole.KID }, "kid-1"),
    ).toBe(false);
  });

  it("still trusts the role when a parent has no profile id", () => {
    // Defensible either way; pinned so the choice is deliberate rather than incidental. A parent
    // is a parent, and the role is what the rule turns on.
    expect(
      canEditProfile({ profileId: null, role: FamilyRole.PARENT }, "kid-1"),
    ).toBe(true);
  });

  it("does not treat a null profile id as matching a null-ish target", () => {
    // Guards the shape of the null check: `actor.profileId === profileId` alone would be true
    // when both sides are absent, handing edit rights to an unseeded account.
    expect(canEditProfile({ profileId: null, role: FamilyRole.KID }, "")).toBe(
      false,
    );
  });
});
