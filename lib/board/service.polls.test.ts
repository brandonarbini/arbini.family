import { beforeEach, describe, expect, it } from "vitest";
import { FamilyRole, ReplyKind } from "@/generated/prisma/enums";
import {
  createPoll,
  deletePoll,
  normalizeOptions,
  reopenPoll,
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

const TODAY = "2026-12-01";

/** A choice, which is what most asks are made of. */
function choice(label: string) {
  return { label, onDate: null };
}

/** A day, which is what the strip on the form produces. */
function day(onDate: string) {
  return { label: null, onDate };
}

async function makePoll(createdById: string | null = null) {
  return createPoll({
    title: "Dinner together",
    createdById,
    options: [choice("Tacos"), choice("Pizza")],
    today: TODAY,
  });
}

async function makeDatedPoll(createdById: string | null = null) {
  return createPoll({
    title: "Camping — which weekend?",
    createdById,
    options: [day("2026-12-05"), day("2026-12-12")],
    today: TODAY,
  });
}

let brandon: Awaited<ReturnType<typeof makeProfile>>;

beforeEach(async () => {
  brandon = await makeProfile("brandon", FamilyRole.PARENT);
});

describe("createPoll", () => {
  it("stores options in the order they were given, with contiguous sortOrder", async () => {
    // Input order, not sorted. Sorting by date was right when every option was a date and is
    // wrong the moment one of them is "tacos" — the order somebody thought of the choices is the
    // order they meant.
    const { id } = await createPoll({
      title: "  What's for dinner?  ",
      createdById: brandon.userId,
      options: [choice("Pizza"), choice("Tacos"), choice("Out")],
      today: TODAY,
    });

    const poll = await prisma.poll.findUniqueOrThrow({
      where: { id },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    expect(poll.title).toBe("What's for dinner?");
    expect(poll.status).toBe("OPEN");
    expect(poll.options.map((o) => o.sortOrder)).toEqual([0, 1, 2]);
    expect(poll.options.map((o) => o.label)).toEqual(["Pizza", "Tacos", "Out"]);
    expect(poll.options.every((o) => o.onDate === null)).toBe(true);
  });

  it("writes dates that read back as the same calendar day", async () => {
    // The boundary the whole `lib/dates` premise rests on: a `@db.Date` written from a
    // `YYYY-MM-DD` string must come back as that string, not the day either side of it.
    const { id } = await createPoll({
      title: "New Year",
      createdById: null,
      options: [day("2027-01-01")],
      today: TODAY,
    });
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    expect(option.onDate!.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    // Null, because the date *is* the label. Writing "Fri 1 Jan" here would freeze a display
    // format into the database.
    expect(option.label).toBeNull();
  });

  it("closes a dateless ask a fortnight out", async () => {
    const { id } = await makePoll();
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.closesOn.toISOString().slice(0, 10)).toBe("2026-12-15");
  });

  it("closes a dated ask on its last day, when that is further out", async () => {
    const { id } = await createPoll({
      title: "Thanksgiving",
      createdById: null,
      options: [day("2027-11-25"), day("2027-11-26")],
      today: TODAY,
    });
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.closesOn.toISOString().slice(0, 10)).toBe("2027-11-26");
  });

  it("never closes an ask earlier than the fortnight, even with only past dates", async () => {
    // An ask that arrives already closed can never be answered. Somebody who proposes yesterday by
    // mistake should be able to fix it rather than start again.
    const { id } = await createPoll({
      title: "Oops",
      createdById: null,
      options: [day("2020-01-01")],
      today: TODAY,
    });
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.closesOn.toISOString().slice(0, 10)).toBe("2026-12-15");
  });

  it("refuses an ask with nothing to choose from", async () => {
    await expect(
      createPoll({
        title: "Empty",
        createdById: null,
        options: [],
        today: TODAY,
      }),
    ).rejects.toThrow(/at least one option/);
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
  it("drops a duplicate choice rather than splitting the tally across it", () => {
    expect(normalizeOptions([choice("Tacos"), choice("Tacos")])).toHaveLength(
      1,
    );
  });

  it("treats a choice as the same however it was capitalised or spaced", () => {
    // "Tacos" and "tacos" are one choice, and a ballot showing both is a ballot nothing can win.
    expect(
      normalizeOptions([choice("Tacos"), choice("  tacos ")]),
    ).toHaveLength(1);
  });

  it("drops a duplicate date", () => {
    expect(
      normalizeOptions([day("2026-12-03"), day("2026-12-03")]),
    ).toHaveLength(1);
  });

  it("keeps a date and a label that read the same", () => {
    // Different kinds of thing, so they cannot collide: a label that happens to look like a day is
    // still a choice, and the family may legitimately want both on one ask.
    expect(
      normalizeOptions([day("2026-12-03"), choice("2026-12-03")]),
    ).toHaveLength(2);
  });

  it("drops an option that says nothing", () => {
    // The empty rows a repeating text field leaves behind, rather than an error to clear.
    expect(
      normalizeOptions([
        choice("Tacos"),
        { label: "   ", onDate: null },
        { label: null, onDate: null },
      ]),
    ).toEqual([{ label: "Tacos", onDate: null }]);
  });

  it("trims a label without losing it", () => {
    expect(normalizeOptions([choice("  Out  ")])).toEqual([
      { label: "Out", onDate: null },
    ]);
  });

  it("keeps the order it was given", () => {
    expect(
      normalizeOptions([day("2026-12-12"), day("2026-12-05")]).map(
        (o) => o.onDate,
      ),
    ).toEqual(["2026-12-12", "2026-12-05"]);
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

/**
 * What settling writes onto the board.
 *
 * The rule under test throughout: settling records what people actually said, and only what
 * nothing else already knows.
 */
describe("settlePoll writes to the board", () => {
  let addison: Awaited<ReturnType<typeof makeProfile>>;

  beforeEach(async () => {
    addison = await makeProfile("addison", FamilyRole.KID);
  });

  async function settleFirstOption(pollId: string) {
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId },
      orderBy: { sortOrder: "asc" },
    });
    return { option, ok: await settlePoll(pollId, option.id) };
  }

  it("puts a settled date on the agenda as an event", async () => {
    const { id } = await makeDatedPoll(brandon.userId);
    const { option } = await settleFirstOption(id);

    const event = await prisma.event.findFirstOrThrow({
      where: { pollId: id },
    });
    expect(event.title).toBe("Camping — which weekend?");
    expect(event.date.toISOString()).toBe(option.onDate!.toISOString());
    expect(event.createdById).toBe(brandon.userId);
    // The date was the whole of the option, so there is nothing left to note.
    expect(event.note).toBeNull();
  });

  it("carries a dated option's own words onto the agenda", async () => {
    const { id } = await createPoll({
      title: "Camping",
      createdById: null,
      options: [{ label: "the long weekend", onDate: "2027-11-25" }],
      today: TODAY,
    });
    await settleFirstOption(id);

    const event = await prisma.event.findFirstOrThrow({
      where: { pollId: id },
    });
    expect(event.date.toISOString().slice(0, 10)).toBe("2027-11-25");
    expect(event.note).toBe("the long weekend");
  });

  it("puts nothing on the agenda when the answer is not a day", async () => {
    // The agenda is a list of dates. A family that has settled on tacos has not settled on a date,
    // and filing "What's for dinner? — Tacos" against a day would be putting an answer where the
    // board keeps appointments.
    const { id } = await makePoll(brandon.userId);
    await settleFirstOption(id);

    expect(await prisma.event.count({ where: { pollId: id } })).toBe(0);
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.status).toBe("SETTLED");
    expect(poll.settledOptionId).not.toBeNull();
  });

  it("takes a date back off the agenda when the family settles on a choice instead", async () => {
    // The clear-then-write has to run even when the new settlement writes nothing, or the agenda
    // keeps a date the family has since decided against.
    const { id } = await createPoll({
      title: "Dinner or camping?",
      createdById: null,
      options: [day("2027-11-25"), choice("Stay in")],
      today: TODAY,
    });
    const options = await prisma.pollOption.findMany({
      where: { pollId: id },
      orderBy: { sortOrder: "asc" },
    });

    await settlePoll(id, options[0].id);
    expect(await prisma.event.count({ where: { pollId: id } })).toBe(1);

    await settlePoll(id, options[1].id);
    expect(await prisma.event.count({ where: { pollId: id } })).toBe(0);
  });

  it("writes nothing about where anybody will be, however they answered", async () => {
    // Settling used to write a stay per yes, because under the place model that was the only
    // thing putting a person anywhere — saying yes to a Thursday *was* the location signal. It is
    // not any more, and this is the test that says so: answering an ask must not quietly assert
    // two days of somebody's calendar. If they mean it, they say so on their own strip.
    const { id } = await makePoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    await replyToPoll(option.id, addison.profileId, ReplyKind.YES);
    await replyToPoll(option.id, brandon.profileId, ReplyKind.YES);

    await settlePoll(id, option.id);

    expect(await prisma.presence.count()).toBe(0);
  });

  it("leaves no ghosts when the family settles on a different date", async () => {
    // Settle, reopen, settle elsewhere is ordinary. Without the clear-then-write the agenda would
    // accumulate every date the family ever considered.
    const { id } = await makeDatedPoll();
    const options = await prisma.pollOption.findMany({
      where: { pollId: id },
      orderBy: { sortOrder: "asc" },
    });

    await settlePoll(id, options[0].id);
    await settlePoll(id, options[1].id);

    const events = await prisma.event.findMany({ where: { pollId: id } });
    expect(events).toHaveLength(1);
    expect(events[0].date.toISOString()).toBe(options[1].onDate!.toISOString());
  });

  it("takes the date back off the agenda when the ask is reopened", async () => {
    const { id } = await makeDatedPoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    await settlePoll(id, option.id);

    await reopenPoll(id);

    expect(await prisma.event.count({ where: { pollId: id } })).toBe(0);
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    expect(poll.status).toBe("OPEN");
    expect(poll.settledOptionId).toBeNull();
  });

  it("takes the date off the agenda when the ask is deleted", async () => {
    const { id } = await makeDatedPoll();
    const option = await prisma.pollOption.findFirstOrThrow({
      where: { pollId: id },
    });
    await settlePoll(id, option.id);

    await deletePoll(id);

    expect(await prisma.event.count()).toBe(0);
  });

  it("leaves what somebody said about their own days alone", async () => {
    // Presence carries no `pollId` at all now, so nothing settling does can reach it. Worth a
    // test rather than an assumption: this used to be a cascade scoped by that column, and the
    // column going away is exactly the kind of change that quietly widens a delete.
    const { id } = await makePoll();
    const mine = await prisma.presence.create({
      data: {
        profileId: addison.profileId,
        state: "AWAY",
        startsOn: new Date("2026-12-20T00:00:00Z"),
        endsOn: new Date("2026-12-27T00:00:00Z"),
      },
    });

    await deletePoll(id);

    expect(
      await prisma.presence.findUnique({ where: { id: mine.id } }),
    ).not.toBeNull();
  });
});
