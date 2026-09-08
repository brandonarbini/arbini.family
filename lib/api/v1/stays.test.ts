import { describe, expect, it } from "vitest";
import { FamilyRole } from "@/generated/prisma/enums";
import {
  handleCreateStay,
  handleDeleteStay,
  handleUpdateStay,
  parseStayInput,
} from "@/lib/api/v1/stays";
import type { Actor } from "@/lib/board/permissions";
import { prisma } from "@/lib/prisma";

/**
 * The stay write path as the app reaches it, against a real database.
 *
 * These are the checks a route handler cannot cover: a handler needs a request context Vitest has
 * no way to supply, which is exactly why the decisions live in `lib/api/v1/stays.ts` and not in
 * `route.ts`. Sequential by necessity — `test/db.ts` truncates between tests.
 */

async function makeProfile(name: string, role: FamilyRole = FamilyRole.KID) {
  const user = await prisma.user.create({
    data: { email: `${name}@example.test`, name, emailVerified: true },
  });
  const profile = await prisma.profile.create({
    data: { userId: user.id, role, sortOrder: 0 },
  });
  return {
    actor: { id: user.id, profileId: profile.id, role } satisfies Actor,
    profileId: profile.id,
  };
}

async function makePlace(name: string) {
  return prisma.place.create({ data: { name, isHome: false } });
}

describe("parseStayInput", () => {
  const base = {
    profileId: "8ee1a0e6-2b4b-4a1f-9a0e-6c3b2d1f4a5b",
    placeId: "1f0c9c3a-7d2e-4b6a-8c1d-9e0f2a3b4c5d",
    startsOn: "2026-09-10",
    endsOn: "2026-09-12",
    note: null,
  };

  it("accepts an open-ended stay", () => {
    const parsed = parseStayInput({ ...base, endsOn: null });
    expect(parsed.ok).toBe(true);
  });

  it("accepts a one-night stay, where the last day equals the first", () => {
    // `endsOn` is the last day *at* the place, so equal dates are a real stay, not an empty range.
    const parsed = parseStayInput({ ...base, endsOn: base.startsOn });
    expect(parsed.ok).toBe(true);
  });

  it("rejects a range that ends before it starts, against the endsOn field", () => {
    const parsed = parseStayInput({ ...base, endsOn: "2026-09-09" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.result.code).toBe("invalid_input");
    // The field matters as much as the failure: a form has to know where to put the message.
    expect(parsed.result.fieldErrors?.endsOn?.[0]).toContain(
      "can't be before the first day",
    );
  });

  it("rejects a date that is not a calendar date", () => {
    const parsed = parseStayInput({ ...base, startsOn: "10/09/2026" });
    expect(parsed.ok).toBe(false);
  });

  it("rejects a note over the limit", () => {
    const parsed = parseStayInput({ ...base, note: "x".repeat(201) });
    expect(parsed.ok).toBe(false);
  });
});

describe("stay writes", () => {
  it("lets someone record their own stay", async () => {
    const { actor, profileId } = await makeProfile("kid");
    const place = await makePlace("Vanguard");

    const result = await handleCreateStay(actor, {
      profileId,
      placeId: place.id,
      startsOn: "2026-09-10",
      endsOn: null,
      note: null,
    });

    expect(result.ok).toBe(true);
    expect(await prisma.stay.count()).toBe(1);
  });

  it("refuses a kid recording a stay for somebody else", async () => {
    const { actor } = await makeProfile("kid");
    const other = await makeProfile("sibling");
    const place = await makePlace("Vanguard");

    const result = await handleCreateStay(actor, {
      profileId: other.profileId,
      placeId: place.id,
      startsOn: "2026-09-10",
      endsOn: null,
      note: null,
    });

    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(await prisma.stay.count()).toBe(0);
  });

  it("lets a parent record a stay for anyone", async () => {
    const parent = await makeProfile("parent", FamilyRole.PARENT);
    const kid = await makeProfile("kid");
    const place = await makePlace("Vanguard");

    const result = await handleCreateStay(parent.actor, {
      profileId: kid.profileId,
      placeId: place.id,
      startsOn: "2026-09-10",
      endsOn: null,
      note: null,
    });

    expect(result.ok).toBe(true);
  });

  /**
   * The escalation the second ownership check exists to stop.
   *
   * A kid sends their *own* profileId — which they are perfectly entitled to edit — alongside a
   * stayId belonging to a parent. Authorising only the submitted profile would pass, and the
   * update would reassign the parent's row to the kid.
   */
  it("refuses a kid editing a parent's stay by submitting their own profileId", async () => {
    const parent = await makeProfile("parent", FamilyRole.PARENT);
    const kid = await makeProfile("kid");
    const place = await makePlace("Vanguard");

    const parentStay = await handleCreateStay(parent.actor, {
      profileId: parent.profileId,
      placeId: place.id,
      startsOn: "2026-09-10",
      endsOn: null,
      note: null,
    });
    if (!parentStay.ok) throw new Error("setup failed");

    const result = await handleUpdateStay(kid.actor, parentStay.stayId, {
      profileId: kid.profileId,
      placeId: place.id,
      startsOn: "2026-09-11",
      endsOn: null,
      note: "mine now",
    });

    expect(result).toMatchObject({ ok: false, code: "forbidden" });

    const row = await prisma.stay.findUnique({
      where: { id: parentStay.stayId },
    });
    expect(row?.profileId).toBe(parent.profileId);
    expect(row?.note).toBeNull();
  });

  it("reports a missing stay as not found rather than forbidden", async () => {
    const { actor, profileId } = await makeProfile("kid");
    const place = await makePlace("Vanguard");

    const result = await handleUpdateStay(
      actor,
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      {
        profileId,
        placeId: place.id,
        startsOn: "2026-09-10",
        endsOn: null,
        note: null,
      },
    );

    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("lets someone delete their own stay, and refuses somebody else's", async () => {
    const { actor, profileId } = await makeProfile("kid");
    const other = await makeProfile("sibling");
    const place = await makePlace("Vanguard");

    const mine = await handleCreateStay(actor, {
      profileId,
      placeId: place.id,
      startsOn: "2026-09-10",
      endsOn: null,
      note: null,
    });
    if (!mine.ok) throw new Error("setup failed");

    expect(await handleDeleteStay(other.actor, mine.stayId)).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(await prisma.stay.count()).toBe(1);

    expect((await handleDeleteStay(actor, mine.stayId)).ok).toBe(true);
    expect(await prisma.stay.count()).toBe(0);
  });

  it("gives an actor with no profile no write access at all", async () => {
    const orphan: Actor = { id: "someone", profileId: null, role: null };
    const place = await makePlace("Vanguard");
    const { profileId } = await makeProfile("kid");

    const result = await handleCreateStay(orphan, {
      profileId,
      placeId: place.id,
      startsOn: "2026-09-10",
      endsOn: null,
      note: null,
    });

    expect(result).toMatchObject({ ok: false, code: "forbidden" });
  });
});
