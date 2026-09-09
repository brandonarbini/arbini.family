import { describe, expect, it } from "vitest";
import {
  type PresenceState,
  type PresenceWindow,
  coversDate,
  findNextGathering,
  horizonFrom,
  statesOn,
  unsaidOn,
} from "@/lib/presence/derive";

const FAMILY = ["brandon", "kim", "tanner", "ellie", "nico"];

function run(
  profileId: string,
  state: PresenceState,
  startsOn: string,
  endsOn: string | null,
  note: string | null = null,
): PresenceWindow {
  return { profileId, state, startsOn, endsOn, note };
}

/** Everyone around for a single window — the base the gathering tests perturb. */
function allAround(startsOn: string, endsOn: string | null) {
  return FAMILY.map((profileId) => run(profileId, "AROUND", startsOn, endsOn));
}

describe("coversDate", () => {
  it("treats endsOn as the last day the run holds, not the day after", () => {
    const r = run("ellie", "AROUND", "2026-11-20", "2026-11-29");
    expect(coversDate(r, "2026-11-29")).toBe(true);
    expect(coversDate(r, "2026-11-30")).toBe(false);
  });

  it("includes the first day", () => {
    const r = run("ellie", "AROUND", "2026-11-20", "2026-11-29");
    expect(coversDate(r, "2026-11-20")).toBe(true);
    expect(coversDate(r, "2026-11-19")).toBe(false);
  });

  it("covers a single day written with matching dates", () => {
    const r = run("ellie", "AWAY", "2026-11-20", "2026-11-20");
    expect(coversDate(r, "2026-11-20")).toBe(true);
    expect(coversDate(r, "2026-11-21")).toBe(false);
  });

  it("runs forever when open-ended", () => {
    const r = run("nico", "AWAY", "2026-01-01", null);
    expect(coversDate(r, "2030-06-01")).toBe(true);
    expect(coversDate(r, "2025-12-31")).toBe(false);
  });
});

describe("statesOn", () => {
  it("reports null for a person who has said nothing", () => {
    const states = statesOn(
      [run("ellie", "AROUND", "2026-11-20", null)],
      FAMILY,
      "2026-11-21",
    );
    expect(states.get("ellie")).toBe("AROUND");
    expect(states.get("nico")).toBeNull();
  });

  it("distinguishes an away day from an unsaid one", () => {
    const states = statesOn(
      [run("ellie", "AWAY", "2026-11-20", "2026-11-20")],
      ["ellie", "nico"],
      "2026-11-20",
    );
    // The whole model rests on these being different answers: away is a statement, unsaid is the
    // absence of one, and the countdown treats them very differently.
    expect(states.get("ellie")).toBe("AWAY");
    expect(states.get("nico")).toBeNull();
  });

  it("prefers the most recently started run when two overlap", () => {
    const states = statesOn(
      [
        run("ellie", "AROUND", "2026-11-01", "2026-11-30"),
        run("ellie", "AWAY", "2026-11-10", "2026-11-12"),
      ],
      ["ellie"],
      "2026-11-11",
    );
    expect(states.get("ellie")).toBe("AWAY");
  });

  it("breaks an exact startsOn tie with the later element, giving last-write-wins", () => {
    const states = statesOn(
      [
        run("ellie", "AROUND", "2026-11-10", "2026-11-12"),
        run("ellie", "AWAY", "2026-11-10", "2026-11-12"),
      ],
      ["ellie"],
      "2026-11-11",
    );
    expect(states.get("ellie")).toBe("AWAY");
  });
});

describe("findNextGathering", () => {
  it("finds the first day everyone is around", () => {
    const found = findNextGathering(
      allAround("2026-11-26", "2026-11-29"),
      FAMILY,
      "2026-11-01",
    );
    expect(found).toEqual({ date: "2026-11-26" });
  });

  it("declines while anybody has said nothing", () => {
    // Four of five is not a gathering, and silence is never a yes. This is the rule `cb4bf66`
    // established when it deleted the default-place fallback, and retiring places did not relax
    // it — a countdown built on a guess is wrong in exactly the case anybody would act on.
    const rows = allAround("2026-11-26", "2026-11-29").filter(
      (r) => r.profileId !== "nico",
    );
    expect(findNextGathering(rows, FAMILY, "2026-11-01")).toBeNull();
  });

  it("declines on a day somebody has said they are away", () => {
    const rows = [
      ...allAround("2026-11-26", "2026-11-29"),
      run("nico", "AWAY", "2026-11-26", "2026-11-27"),
    ];
    // The away run wins the tie by starting later, so the 26th and 27th are out and the 28th is
    // the answer.
    expect(findNextGathering(rows, FAMILY, "2026-11-01")).toEqual({
      date: "2026-11-28",
    });
  });

  it("counts a day everyone is around wherever they physically are", () => {
    // Christmas at Grandma's. There is no place to compare, and that is the point: AROUND means
    // "with the family", so five of them is a gathering without anybody naming a house.
    const found = findNextGathering(
      allAround("2026-12-25", "2026-12-25"),
      FAMILY,
      "2026-12-01",
    );
    expect(found).toEqual({ date: "2026-12-25" });
  });

  it("returns null rather than a vacuous today for an empty roster", () => {
    expect(findNextGathering([], [], "2026-11-01")).toBeNull();
  });

  it("stops at the horizon", () => {
    const rows = allAround("2026-12-25", "2026-12-25");
    expect(findNextGathering(rows, FAMILY, "2026-11-01", 30)).toBeNull();
    expect(findNextGathering(rows, FAMILY, "2026-11-01", 60)).toEqual({
      date: "2026-12-25",
    });
  });
});

describe("unsaidOn", () => {
  it("names everyone with nothing covering the day, in roster order", () => {
    const rows = [
      run("brandon", "AROUND", "2026-11-20", null),
      run("ellie", "AWAY", "2026-11-20", "2026-11-21"),
    ];
    expect(unsaidOn(rows, FAMILY, "2026-11-20")).toEqual([
      "kim",
      "tanner",
      "nico",
    ]);
  });

  it("counts an away answer as having been said", () => {
    // Away is an answer. The lede waits on silence, not on bad news.
    const rows = [run("ellie", "AWAY", "2026-11-20", "2026-11-20")];
    expect(unsaidOn(rows, ["ellie"], "2026-11-20")).toEqual([]);
  });
});

describe("horizonFrom", () => {
  it("reports the last day of an unbroken stretch from today", () => {
    const rows = [
      run("ellie", "AROUND", "2026-11-20", "2026-11-22"),
      run("ellie", "AWAY", "2026-11-23", "2026-11-25"),
    ];
    expect(horizonFrom(rows, "ellie", "2026-11-20")).toEqual({
      kind: "through",
      date: "2026-11-25",
    });
  });

  it("stops at a gap rather than jumping to the furthest run", () => {
    // Somebody who has said this weekend and next Christmas has not said through Christmas, and
    // reporting the later date would tell them they are covered when eleven months are blank.
    const rows = [
      run("ellie", "AROUND", "2026-11-20", "2026-11-22"),
      run("ellie", "AROUND", "2026-12-24", "2026-12-26"),
    ];
    expect(horizonFrom(rows, "ellie", "2026-11-20")).toEqual({
      kind: "through",
      date: "2026-11-22",
    });
  });

  it("is unsaid when nothing covers today, even if a later run exists", () => {
    const rows = [run("ellie", "AROUND", "2026-12-24", "2026-12-26")];
    expect(horizonFrom(rows, "ellie", "2026-11-20")).toEqual({
      kind: "unsaid",
    });
  });

  it("is open when the run covering today has no last day", () => {
    const rows = [run("ellie", "AWAY", "2026-11-01", null)];
    expect(horizonFrom(rows, "ellie", "2026-11-20")).toEqual({ kind: "open" });
  });

  it("is open when the chain *reaches* an open-ended run, not only when today sits in one", () => {
    // Addison at school, home for a weekend, back at school indefinitely. She has said everything
    // from today to forever, and an earlier version read it as having said nothing at all —
    // because it asked whether an open-ended run covered *today* rather than whether the chain
    // from today ran into one.
    const rows = [
      run("ellie", "AWAY", "2026-11-20", "2026-11-24", "Vanguard"),
      run("ellie", "AROUND", "2026-11-25", "2026-11-29"),
      run("ellie", "AWAY", "2026-11-30", null, "Vanguard"),
    ];
    expect(horizonFrom(rows, "ellie", "2026-11-20")).toEqual({ kind: "open" });
  });

  it("ignores runs that ended before today", () => {
    const rows = [
      run("ellie", "AROUND", "2026-10-01", "2026-10-05"),
      run("ellie", "AROUND", "2026-11-20", "2026-11-22"),
    ];
    expect(horizonFrom(rows, "ellie", "2026-11-20")).toEqual({
      kind: "through",
      date: "2026-11-22",
    });
  });

  it("is unsaid for somebody with no rows at all", () => {
    expect(horizonFrom([], "nico", "2026-11-20")).toEqual({ kind: "unsaid" });
  });
});
