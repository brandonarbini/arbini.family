import { describe, expect, it } from "vitest";
import {
  type PollOptionWindow,
  type PollReplyRecord,
  rankOptions,
  sortOptions,
  tallyPoll,
} from "@/lib/polls/tally";

const FAMILY = ["brandon", "jill", "tanner", "addison", "macy"];

const THU = "option-thu";
const SAT = "option-sat";
const SUN = "option-sun";

function option(
  optionId: string,
  startsOn: string,
  sortOrder: number,
  endsOn = startsOn,
): PollOptionWindow {
  return { optionId, startsOn, endsOn, sortOrder };
}

const OPTIONS = [
  option(THU, "2026-12-03", 0),
  option(SAT, "2026-12-05", 1),
  option(SUN, "2026-12-06", 2),
];

function reply(
  optionId: string,
  profileId: string,
  kind: PollReplyRecord["kind"],
): PollReplyRecord {
  return { optionId, profileId, kind };
}

/** Everyone answers one option the same way — the base the tally tests perturb. */
function allSay(optionId: string, kind: PollReplyRecord["kind"]) {
  return FAMILY.map((profileId) => reply(optionId, profileId, kind));
}

function find(tallies: ReturnType<typeof tallyPoll>, optionId: string) {
  const tally = tallies.find((entry) => entry.optionId === optionId);
  if (!tally) throw new Error(`no tally for ${optionId}`);
  return tally;
}

describe("tallyPoll", () => {
  it("counts each kind separately", () => {
    const tallies = tallyPoll(
      OPTIONS,
      [
        reply(THU, "brandon", "YES"),
        reply(THU, "jill", "YES"),
        reply(THU, "tanner", "MAYBE"),
        reply(THU, "addison", "NO"),
      ],
      FAMILY,
    );
    const thu = find(tallies, THU);
    expect(thu.yes).toBe(2);
    expect(thu.maybe).toBe(1);
    expect(thu.no).toBe(1);
    expect(thu.yesBy).toEqual(["brandon", "jill"]);
    expect(thu.silentBy).toEqual(["macy"]);
  });

  it("counts people who have not answered as silent, never as no", () => {
    // The distinction the whole ballot rests on: not answering is a gap, and rendering it as a
    // refusal would make the board confidently wrong about somebody who simply has not looked.
    const tallies = tallyPoll(OPTIONS, [reply(THU, "brandon", "YES")], FAMILY);
    const thu = find(tallies, THU);
    expect(thu.no).toBe(0);
    expect(thu.silentBy).toEqual(["jill", "tanner", "addison", "macy"]);
  });

  it("keeps each option's replies to itself", () => {
    const tallies = tallyPoll(OPTIONS, allSay(SAT, "YES"), FAMILY);
    expect(find(tallies, SAT).yes).toBe(5);
    expect(find(tallies, THU).yes).toBe(0);
    expect(find(tallies, THU).silentBy).toEqual(FAMILY);
  });

  it("reports everyoneCanMake only when every person said yes", () => {
    expect(
      find(tallyPoll(OPTIONS, allSay(SAT, "YES"), FAMILY), SAT).everyoneCanMake,
    ).toBe(true);
  });

  it("does not report everyoneCanMake when nobody objected but somebody stayed silent", () => {
    // Silence is not consent. A poll that settled a date because three people ignored it would
    // be wrong in exactly the case anybody would act on.
    const replies = allSay(SAT, "YES").filter((r) => r.profileId !== "macy");
    expect(find(tallyPoll(OPTIONS, replies, FAMILY), SAT).everyoneCanMake).toBe(
      false,
    );
  });

  it("does not report everyoneCanMake on a maybe", () => {
    const replies = [
      ...allSay(SAT, "YES").filter((r) => r.profileId !== "macy"),
      reply(SAT, "macy", "MAYBE"),
    ];
    expect(find(tallyPoll(OPTIONS, replies, FAMILY), SAT).everyoneCanMake).toBe(
      false,
    );
  });

  it("reports no gathering for an empty family rather than a vacuous yes", () => {
    expect(tallyPoll(OPTIONS, [], []).every((t) => !t.everyoneCanMake)).toBe(
      true,
    );
  });

  it("ignores replies from someone outside the family", () => {
    // A profile removed from the board should not keep voting, and its stale rows must not push
    // a tally past the number of people in the family.
    const tallies = tallyPoll(
      OPTIONS,
      [...allSay(SAT, "YES"), reply(SAT, "ghost", "YES")],
      FAMILY,
    );
    expect(find(tallies, SAT).yes).toBe(5);
  });

  it("produces identical output when the replies arrive in a different order", () => {
    // The flicker test. The replies come back from a query whose relative order is not
    // guaranteed, and the avatars must not swap places between re-fetches.
    const replies = [
      reply(THU, "macy", "NO"),
      reply(THU, "brandon", "YES"),
      reply(SAT, "tanner", "MAYBE"),
      reply(THU, "jill", "YES"),
      reply(SAT, "addison", "YES"),
    ];
    expect(tallyPoll(OPTIONS, replies, FAMILY)).toEqual(
      tallyPoll(OPTIONS, [...replies].reverse(), FAMILY),
    );
  });

  it("returns options in presentation order regardless of input order", () => {
    const tallies = tallyPoll([...OPTIONS].reverse(), [], FAMILY);
    expect(tallies.map((t) => t.optionId)).toEqual([THU, SAT, SUN]);
  });
});

describe("rankOptions", () => {
  it("puts an option everyone can make first", () => {
    const tallies = tallyPoll(
      OPTIONS,
      [
        ...allSay(SAT, "YES"),
        ...FAMILY.map((p) => reply(THU, p, "YES")).slice(0, 4),
      ],
      FAMILY,
    );
    expect(rankOptions(tallies)[0].optionId).toBe(SAT);
  });

  it("ranks by yes count when nobody can make them all", () => {
    const tallies = tallyPoll(
      OPTIONS,
      [
        reply(THU, "brandon", "YES"),
        reply(SAT, "brandon", "YES"),
        reply(SAT, "jill", "YES"),
        reply(SAT, "tanner", "YES"),
      ],
      FAMILY,
    );
    expect(rankOptions(tallies).map((t) => t.optionId)).toEqual([
      SAT,
      THU,
      SUN,
    ]);
  });

  it("breaks an equal yes count on maybes, which never outrank a yes", () => {
    const tallies = tallyPoll(
      OPTIONS,
      [
        reply(THU, "brandon", "YES"),
        reply(SAT, "brandon", "YES"),
        reply(SAT, "jill", "MAYBE"),
        reply(SAT, "tanner", "MAYBE"),
      ],
      FAMILY,
    );
    const ranked = rankOptions(tallies);
    expect(ranked[0].optionId).toBe(SAT);
    expect(ranked[0].yes).toBe(1);
  });

  it("falls back to the poll's own order, so equally good dates stay chronological", () => {
    expect(
      rankOptions(tallyPoll(OPTIONS, [], FAMILY)).map((t) => t.optionId),
    ).toEqual([THU, SAT, SUN]);
  });

  it("does not mutate its input", () => {
    const tallies = tallyPoll(OPTIONS, allSay(SUN, "YES"), FAMILY);
    const before = tallies.map((t) => t.optionId);
    rankOptions(tallies);
    expect(tallies.map((t) => t.optionId)).toEqual(before);
  });
});

describe("sortOptions", () => {
  it("orders by sortOrder, then date, then id, so the sort is total", () => {
    const tied = [
      option("b", "2026-12-05", 0),
      option("a", "2026-12-05", 0),
      option("c", "2026-12-04", 0),
    ];
    expect(sortOptions(tied).map((o) => o.optionId)).toEqual(["c", "a", "b"]);
    expect(sortOptions([...tied].reverse()).map((o) => o.optionId)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});
