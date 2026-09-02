import { beforeEach, describe, expect, it } from "vitest";
import { FamilyRole, ReplyKind } from "@/generated/prisma/enums";
import {
  createPoll,
  deletePoll,
  normalizeOptions,
  replyToPoll,
  settlePoll,
} from "@/lib/board/service";
import { prisma } from "@/lib/prisma";

/**
 * The poll write path, against a real database.
 *
 * Sequential by necessity — `test/db.ts` truncates between tests, and concurrent tests in one
 * file share the worker's database.
 */

async function makeProfile(name: string, role: FamilyRole = FamilyRole.KID) {
  const user = await prisma.user.create({
    data: { email: `${name}@example.test`, name, emailVerified: true },
  });
  const profile = await prisma.profile.create({
    data: { userId: user.id, role, sortOrder: 0 },
  });
  return { userId: user.id, profileId: profile.id };
}

async function makePoll(createdById: string | null = null) {
  return createPoll({
    title: "Dinner together",
    createdById,
    options: [
      { startsOn: "2026-12-03", endsOn: "2026-12-03" },
      { startsOn: "2026-12-05", endsOn: "2026-12-06" },
    ],
  });
}

let brandon: Awaited<ReturnType<typeof makeProfile>>;

beforeEach(async () => {
  brandon = await makeProfile("brandon", FamilyRole.PARENT);
});

describe("createPoll", () => {
  it("stores options in date order with contiguous sortOrder", async () => {
    const { id } = await createPoll({
      title: "  Dinner together  ",
      createdById: brandon.userId,
      options: [
        { startsOn: "2026-12-06", endsOn: "2026-12-06" },
        { startsOn: "2026-12-03", endsOn: "2026-12-03" },
      ],
    });

    const poll = await prisma.poll.findUniqueOrThrow({
      where: { id },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    expect(poll.title).toBe("Dinner together");
    expect(poll.status).toBe("OPEN");
    expect(poll.options.map((o) => o.sortOrder)).toEqual([0, 1]);
    expect(
      poll.options.map((o) => o.startsOn.toISOString().slice(0, 10)),
    ).toEqual(["2026-12-03", "2026-12-06"]);
  });

  it("writes dates that read back as the same calendar day", async () => {
    // The boundary the whole `lib/dates` premise rests on: a `@db.Date` written from a
    // `YYYY-MM-DD` string must come back as that string, not the day either side of it.
    const { id } = await createPoll({
      title: "New Year",
      createdById: null,
      options: [{ startsOn: "2027-01-01", endsOn: "2027-01-01" }],
    });
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    expect(option.startsOn.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("refuses a poll with no dates", async () => {
    await expect(
      createPoll({ title: "Empty", createdById: null, options: [] }),
    ).rejects.toThrow(/at least one date/);
  });

  it("survives its creator's account being removed", async () => {
    // SetNull, matching Event: the family's record of what it decided should outlive the account
    // that asked the question.
    const { id } = await makePoll(brandon.userId);
    await prisma.user.delete({ where: { id: brandon.userId } });
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.createdById).toBeNull();
  });
});

describe("normalizeOptions", () => {
  it("drops a duplicate date rather than splitting the tally across it", () => {
    expect(
      normalizeOptions([
        { startsOn: "2026-12-03", endsOn: "2026-12-03" },
        { startsOn: "2026-12-03", endsOn: "2026-12-03" },
      ]),
    ).toHaveLength(1);
  });

  it("keeps a single day and a range that share a start", () => {
    expect(
      normalizeOptions([
        { startsOn: "2026-12-03", endsOn: "2026-12-03" },
        { startsOn: "2026-12-03", endsOn: "2026-12-06" },
      ]),
    ).toHaveLength(2);
  });

  it("rejects a range that ends before it starts", () => {
    expect(() =>
      normalizeOptions([{ startsOn: "2026-12-06", endsOn: "2026-12-03" }]),
    ).toThrow(/before it starts/);
  });
});

describe("replyToPoll", () => {
  it("updates rather than duplicating when somebody changes their mind", async () => {
    // The most likely thing to happen on a phone. Without the unique pair the tally would count
    // one person twice.
    const { id } = await makePoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });

    await replyToPoll(option.id, brandon.profileId, ReplyKind.YES);
    await replyToPoll(option.id, brandon.profileId, ReplyKind.NO);

    const replies = await prisma.pollReply.findMany({
      where: { optionId: option.id },
    });
    expect(replies).toHaveLength(1);
    expect(replies[0].kind).toBe("NO");
  });

  it("cascades replies away with the poll", async () => {
    const { id } = await makePoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    await replyToPoll(option.id, brandon.profileId, ReplyKind.YES);

    await deletePoll(id);

    expect(await prisma.pollOption.count()).toBe(0);
    expect(await prisma.pollReply.count()).toBe(0);
  });

  it("cascades replies away with the person", async () => {
    const { id } = await makePoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    await replyToPoll(option.id, brandon.profileId, ReplyKind.YES);

    await prisma.profile.delete({ where: { id: brandon.profileId } });

    expect(await prisma.pollReply.count()).toBe(0);
  });
});

describe("settlePoll", () => {
  it("settles on one of the poll's own options", async () => {
    const { id } = await makePoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });

    expect(await settlePoll(id, option.id)).toBe(true);

    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.status).toBe("SETTLED");
    expect(poll.settledOptionId).toBe(option.id);
    expect(poll.settledAt).not.toBeNull();
  });

  it("refuses an option belonging to a different poll", async () => {
    // Otherwise the ballot renders a chosen date that appears nowhere among its own choices.
    const mine = await makePoll();
    const theirs = await makePoll();
    const foreign = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: theirs.id },
    });

    expect(await settlePoll(mine.id, foreign.id)).toBe(false);

    const poll = await prisma.poll.findUniqueOrThrow({
      where: { id: mine.id },
    });
    expect(poll.status).toBe("OPEN");
    expect(poll.settledOptionId).toBeNull();
  });

  it("un-settles rather than cascading when the chosen option is deleted", async () => {
    // SetNull: losing the option must not delete the poll the family already acted on.
    const { id } = await makePoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    await settlePoll(id, option.id);

    await prisma.pollOption.delete({ where: { id: option.id } });

    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.settledOptionId).toBeNull();
  });
});
