import { describe, expect, it } from "vitest";
import { FamilyRole, ReplyKind } from "@/generated/prisma/enums";
import { handleReply, parseReplyInput } from "@/lib/api/v1/polls";
import type { Actor } from "@/lib/board/permissions";
import { createPoll, settlePoll } from "@/lib/board/service";
import { prisma } from "@/lib/prisma";

/**
 * Answering a poll from the app, against a real database.
 *
 * The rule under test is deliberately stricter than the Around strip's: a parent may paint
 * anybody's days, but nobody answers a poll in somebody else's voice.
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

async function makePoll(createdById: string | null = null) {
  return createPoll({
    title: "What's for dinner?",
    createdById,
    options: [
      { label: "Tacos", onDate: null },
      { label: "Pizza", onDate: null },
    ],
    today: "2099-12-01",
  });
}

async function optionIdsOf(pollId: string) {
  const options = await prisma.pollOption.findMany({
    where: { pollId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return options.map((option) => option.id);
}

describe("parseReplyInput", () => {
  it("accepts the three answers and a null that clears", () => {
    for (const kind of ["YES", "MAYBE", "NO", null]) {
      expect(parseReplyInput({ kind }).ok).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(parseReplyInput({ kind: "PROBABLY" }).ok).toBe(false);
    expect(parseReplyInput({}).ok).toBe(false);
  });
});

describe("answering a poll", () => {
  it("records your own answer", async () => {
    const me = await makeProfile("me");
    const poll = await makePoll(me.actor.id);
    const [first] = await optionIdsOf(poll.id);

    const result = await handleReply(me.actor, first, me.profileId, {
      kind: "YES",
    });

    expect(result.ok).toBe(true);
    const saved = await prisma.pollReply.findFirst({
      where: { optionId: first, profileId: me.profileId },
    });
    expect(saved?.kind).toBe(ReplyKind.YES);
  });

  it("replaces rather than duplicates when you change your mind", async () => {
    const me = await makeProfile("me");
    const poll = await makePoll();
    const [first] = await optionIdsOf(poll.id);

    await handleReply(me.actor, first, me.profileId, { kind: "YES" });
    await handleReply(me.actor, first, me.profileId, { kind: "NO" });

    const replies = await prisma.pollReply.findMany({
      where: { optionId: first, profileId: me.profileId },
    });
    expect(replies).toHaveLength(1);
    expect(replies[0].kind).toBe(ReplyKind.NO);
  });

  it("clears an answer without recording a no", async () => {
    const me = await makeProfile("me");
    const poll = await makePoll();
    const [first] = await optionIdsOf(poll.id);

    await handleReply(me.actor, first, me.profileId, { kind: "MAYBE" });
    const result = await handleReply(me.actor, first, me.profileId, {
      kind: null,
    });

    expect(result.ok).toBe(true);
    // Silent again, which the tally counts separately from a refusal.
    expect(await prisma.pollReply.count({ where: { optionId: first } })).toBe(
      0,
    );
  });

  /**
   * The asymmetry with `canEditProfile`, stated as a test so it cannot be "simplified" away.
   */
  it("refuses a parent answering on a kid's behalf", async () => {
    const parent = await makeProfile("parent", FamilyRole.PARENT);
    const kid = await makeProfile("kid");
    const poll = await makePoll();
    const [first] = await optionIdsOf(poll.id);

    const result = await handleReply(parent.actor, first, kid.profileId, {
      kind: "YES",
    });

    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(await prisma.pollReply.count()).toBe(0);
  });

  it("refuses answering on a settled poll", async () => {
    const me = await makeProfile("me");
    const poll = await makePoll(me.actor.id);
    const [first, second] = await optionIdsOf(poll.id);
    await settlePoll(poll.id, first);

    const result = await handleReply(me.actor, second, me.profileId, {
      kind: "YES",
    });

    // Settling wrote stays and events from the tally; letting a late answer change it would leave
    // the board disagreeing with the poll it came from.
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("reports an unknown option as not found", async () => {
    const me = await makeProfile("me");

    const result = await handleReply(
      me.actor,
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      me.profileId,
      { kind: "YES" },
    );

    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("gives an actor with no profile no say at all", async () => {
    const orphan: Actor = { id: "someone", profileId: null, role: null };
    const poll = await makePoll();
    const [first] = await optionIdsOf(poll.id);

    const result = await handleReply(orphan, first, "whoever", { kind: "YES" });

    expect(result).toMatchObject({ ok: false, code: "forbidden" });
  });
});
