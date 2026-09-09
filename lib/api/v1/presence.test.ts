import { describe, expect, it } from "vitest";
import { FamilyRole } from "@/generated/prisma/enums";
import { eachCalendarDay } from "@/lib/dates";
import { handleSetPresence, parsePresenceInput } from "@/lib/api/v1/presence";
import type { Actor } from "@/lib/board/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Saying where you'll be from the app, against a real database.
 *
 * Two things are worth reaching directly. The authorization rule — a kid paints only their own
 * days, a parent paints anybody's — and the fact that a write leaves the calendar *coherent*,
 * with no overlapping rows, however many times it is pressed.
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

/** The days between two dates, inclusive — a range expressed the way the strip submits one. */
function eachDay(from: string, to: string): string[] {
  return eachCalendarDay(from, to);
}

async function rowsFor(profileId: string) {
  const rows = await prisma.presence.findMany({
    where: { profileId },
    orderBy: { startsOn: "asc" },
  });
  return rows.map((row) => ({
    state: row.state,
    startsOn: row.startsOn.toISOString().slice(0, 10),
    endsOn: row.endsOn?.toISOString().slice(0, 10) ?? null,
    note: row.note,
  }));
}

/** Three consecutive days, which the writer collapses into one row. */
const RUN = {
  state: "AROUND" as const,
  days: ["2026-11-20", "2026-11-21", "2026-11-22"],
  note: null,
};

describe("parsePresenceInput", () => {
  it("accepts a single day", () => {
    const parsed = parsePresenceInput({
      profileId: crypto.randomUUID(),
      ...RUN,
      days: ["2026-11-20"],
    });
    expect(parsed.ok).toBe(true);
  });

  it("accepts days that are not contiguous", () => {
    // The strip is fourteen individually tappable cells, so "Friday, Saturday and the Tuesday
    // after" is one ordinary act rather than three.
    const parsed = parsePresenceInput({
      profileId: crypto.randomUUID(),
      ...RUN,
      days: ["2026-11-20", "2026-11-21", "2026-11-24"],
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects an empty selection", () => {
    const parsed = parsePresenceInput({
      profileId: crypto.randomUUID(),
      ...RUN,
      days: [],
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts a null state, which clears rather than records an away", () => {
    const parsed = parsePresenceInput({
      profileId: crypto.randomUUID(),
      ...RUN,
      state: null,
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects a date that matches the shape but is not a day", () => {
    const parsed = parsePresenceInput({
      profileId: crypto.randomUUID(),
      ...RUN,
      days: ["2026-02-30"],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.result.code).toBe("invalid_input");
  });

  it("rejects a state that is neither around nor away", () => {
    const parsed = parsePresenceInput({
      profileId: crypto.randomUUID(),
      ...RUN,
      state: "MAYBE",
    });
    expect(parsed.ok).toBe(false);
  });
});

describe("handleSetPresence", () => {
  it("records what somebody says about their own days", async () => {
    const me = await makeProfile("macy");
    const result = await handleSetPresence(me.actor, {
      profileId: me.profileId,
      ...RUN,
    });

    expect(result.ok).toBe(true);
    expect(await rowsFor(me.profileId)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-22",
        note: null,
      },
    ]);
  });

  it("refuses a kid painting somebody else's days", async () => {
    const me = await makeProfile("macy");
    const sibling = await makeProfile("tanner");

    const result = await handleSetPresence(me.actor, {
      profileId: sibling.profileId,
      ...RUN,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("forbidden");
    expect(await rowsFor(sibling.profileId)).toEqual([]);
  });

  it("lets a parent paint anybody's days", async () => {
    const parent = await makeProfile("brandon", FamilyRole.PARENT);
    const kid = await makeProfile("addison");

    const result = await handleSetPresence(parent.actor, {
      profileId: kid.profileId,
      ...RUN,
    });

    expect(result.ok).toBe(true);
    expect(await rowsFor(kid.profileId)).toHaveLength(1);
  });

  it("trims a note, and treats a whitespace-only one as absent", async () => {
    const me = await makeProfile("macy");
    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      ...RUN,
      state: "AWAY",
      note: "  Vanguard  ",
    });
    const [first] = await rowsFor(me.profileId);
    expect(first.note).toBe("Vanguard");

    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      ...RUN,
      days: ["2026-12-01", "2026-12-02"],
      state: "AWAY",
      note: "   ",
    });
    const rows = await rowsFor(me.profileId);
    expect(rows[1].note).toBeNull();
  });

  it("splits an existing run rather than overlapping it", async () => {
    // The invariant the whole read path leans on: one person's rows never overlap, so the strip
    // can render by asking which single run covers each day.
    const me = await makeProfile("addison");
    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      state: "AROUND",
      days: eachDay("2026-11-01", "2026-11-30"),
      note: null,
    });

    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      state: "AWAY",
      days: eachDay("2026-11-10", "2026-11-12"),
      note: "Vanguard",
    });

    expect(await rowsFor(me.profileId)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-01",
        endsOn: "2026-11-09",
        note: null,
      },
      {
        state: "AWAY",
        startsOn: "2026-11-10",
        endsOn: "2026-11-12",
        note: "Vanguard",
      },
      {
        state: "AROUND",
        startsOn: "2026-11-13",
        endsOn: "2026-11-30",
        note: null,
      },
    ]);
  });

  it("keeps an open-ended run open when days are carved out of it", async () => {
    // Seeded directly, because a list of days can never *create* an open-ended run — it always
    // has a last day. The row exists in the model and the API can still act on it, and this is
    // the case that would break first if `setDays` ever dropped the tail's openness: Addison is
    // at school until further notice, and comes home for a weekend.
    const me = await makeProfile("addison");
    await prisma.presence.create({
      data: {
        profileId: me.profileId,
        state: "AWAY",
        startsOn: new Date("2026-09-01T00:00:00Z"),
        endsOn: null,
        note: "Vanguard",
      },
    });

    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      state: "AROUND",
      days: eachDay("2026-11-26", "2026-11-29"),
      note: null,
    });

    expect(await rowsFor(me.profileId)).toEqual([
      {
        state: "AWAY",
        startsOn: "2026-09-01",
        endsOn: "2026-11-25",
        note: "Vanguard",
      },
      {
        state: "AROUND",
        startsOn: "2026-11-26",
        endsOn: "2026-11-29",
        note: null,
      },
      { state: "AWAY", startsOn: "2026-11-30", endsOn: null, note: "Vanguard" },
    ]);
  });

  it("stores a selection with a gap in it as two rows", async () => {
    // The reason the wire carries days rather than a first-and-last pair: "Friday, Saturday and
    // the Tuesday after" is one ordinary act on the strip, and a range cannot express it.
    const me = await makeProfile("macy");
    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      state: "AROUND",
      days: ["2026-11-20", "2026-11-21", "2026-11-24"],
      note: null,
    });

    expect(await rowsFor(me.profileId)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-21",
        note: null,
      },
      {
        state: "AROUND",
        startsOn: "2026-11-24",
        endsOn: "2026-11-24",
        note: null,
      },
    ]);
  });

  it("is idempotent, because a double tap on a phone is ordinary", async () => {
    const me = await makeProfile("macy");
    await handleSetPresence(me.actor, { profileId: me.profileId, ...RUN });
    await handleSetPresence(me.actor, { profileId: me.profileId, ...RUN });

    expect(await rowsFor(me.profileId)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-22",
        note: null,
      },
    ]);
  });

  it("merges an adjacent run of the same state instead of adding a row", async () => {
    const me = await makeProfile("macy");
    await handleSetPresence(me.actor, { profileId: me.profileId, ...RUN });
    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      state: "AROUND",
      days: eachDay("2026-11-23", "2026-11-24"),
      note: null,
    });

    expect(await rowsFor(me.profileId)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-24",
        note: null,
      },
    ]);
  });

  it("clears days back to unsaid when the state is null", async () => {
    const me = await makeProfile("macy");
    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      state: "AROUND",
      days: eachDay("2026-11-01", "2026-11-30"),
      note: null,
    });

    await handleSetPresence(me.actor, {
      profileId: me.profileId,
      state: null,
      days: eachDay("2026-11-10", "2026-11-12"),
      note: null,
    });

    // A hole, not a third state. The board draws those days as a gap, which is what it draws for
    // a day nobody has reached yet.
    expect(await rowsFor(me.profileId)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-01",
        endsOn: "2026-11-09",
        note: null,
      },
      {
        state: "AROUND",
        startsOn: "2026-11-13",
        endsOn: "2026-11-30",
        note: null,
      },
    ]);
  });

  it("refuses a kid clearing somebody else's days", async () => {
    // Clearing goes through the same authorization as painting. It is the destructive half, so a
    // check that covered only the write would be the worse half to miss.
    const me = await makeProfile("macy");
    const sibling = await makeProfile("tanner");
    await handleSetPresence(sibling.actor, {
      profileId: sibling.profileId,
      ...RUN,
    });

    const result = await handleSetPresence(me.actor, {
      profileId: sibling.profileId,
      ...RUN,
      state: null,
    });

    expect(result.ok).toBe(false);
    expect(await rowsFor(sibling.profileId)).toHaveLength(1);
  });

  it("never touches another person's calendar", async () => {
    const parent = await makeProfile("brandon", FamilyRole.PARENT);
    const kid = await makeProfile("addison");
    await handleSetPresence(kid.actor, { profileId: kid.profileId, ...RUN });

    await handleSetPresence(parent.actor, {
      profileId: parent.profileId,
      state: "AWAY",
      days: eachDay("2026-11-19", "2026-11-25"),
      note: null,
    });

    expect(await rowsFor(kid.profileId)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-22",
        note: null,
      },
    ]);
  });
});
