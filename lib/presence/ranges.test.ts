import { describe, expect, it } from "vitest";
import { type Run, groupIntoRuns, merge, setDays } from "@/lib/presence/ranges";

function run(
  state: Run["state"],
  startsOn: string,
  endsOn: string | null,
  note: string | null = null,
  id?: string,
): Run {
  return { id, state, startsOn, endsOn, note };
}

/** What the calendar says afterwards: the survivors plus the creates, in date order. */
function resulting(existing: Run[], plan: ReturnType<typeof setDays>): Run[] {
  const kept = existing.filter((r) => !plan.deleteIds.includes(r.id!));
  return [...kept, ...plan.create].sort((a, b) =>
    a.startsOn.localeCompare(b.startsOn),
  );
}

describe("merge", () => {
  it("joins runs that touch and agree", () => {
    expect(
      merge([
        run("AROUND", "2026-11-20", "2026-11-21"),
        run("AROUND", "2026-11-22", "2026-11-23"),
      ]),
    ).toEqual([
      {
        id: undefined,
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-23",
        note: null,
      },
    ]);
  });

  it("leaves a one-day gap unjoined", () => {
    // The fence post: the 22nd is unsaid, and swallowing it would invent an answer for a day
    // nobody spoke about.
    const merged = merge([
      run("AROUND", "2026-11-20", "2026-11-21"),
      run("AROUND", "2026-11-23", "2026-11-24"),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does not join runs of different states", () => {
    const merged = merge([
      run("AROUND", "2026-11-20", "2026-11-21"),
      run("AWAY", "2026-11-22", "2026-11-23"),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("never merges into an open-ended run, which has no end to extend from", () => {
    const merged = merge([
      run("AWAY", "2026-11-20", null),
      run("AWAY", "2026-11-22", "2026-11-23"),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("sorts before merging, so input order does not decide the answer", () => {
    const forward = merge([
      run("AROUND", "2026-11-20", "2026-11-21"),
      run("AROUND", "2026-11-22", "2026-11-23"),
    ]);
    const backward = merge([
      run("AROUND", "2026-11-22", "2026-11-23"),
      run("AROUND", "2026-11-20", "2026-11-21"),
    ]);
    expect(forward).toEqual(backward);
  });
});

describe("groupIntoRuns", () => {
  it("collapses consecutive days into one run", () => {
    expect(groupIntoRuns(["2026-11-20", "2026-11-21", "2026-11-22"])).toEqual([
      { from: "2026-11-20", to: "2026-11-22" },
    ]);
  });

  it("keeps a gap as two runs", () => {
    // "Friday, Saturday and the Tuesday after" is one act on the strip and two rows in the
    // database, and the fence post between them is the whole reason this is its own function.
    expect(groupIntoRuns(["2026-11-20", "2026-11-21", "2026-11-24"])).toEqual([
      { from: "2026-11-20", to: "2026-11-21" },
      { from: "2026-11-24", to: "2026-11-24" },
    ]);
  });

  it("sorts before grouping, so tap order does not decide the answer", () => {
    expect(groupIntoRuns(["2026-11-22", "2026-11-20", "2026-11-21"])).toEqual([
      { from: "2026-11-20", to: "2026-11-22" },
    ]);
  });

  it("drops a repeated day rather than emitting an empty second run", () => {
    expect(groupIntoRuns(["2026-11-20", "2026-11-20"])).toEqual([
      { from: "2026-11-20", to: "2026-11-20" },
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(groupIntoRuns([])).toEqual([]);
  });
});

describe("setDays", () => {
  it("writes one row for a contiguous selection", () => {
    const plan = setDays(
      [],
      ["2026-11-20", "2026-11-21", "2026-11-22"],
      "AROUND",
      null,
    );
    expect(plan.create).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-22",
        note: null,
      },
    ]);
  });

  it("writes two rows for a selection with a gap in it", () => {
    const plan = setDays([], ["2026-11-20", "2026-11-24"], "AWAY", "Vanguard");
    expect(plan.create).toEqual([
      {
        state: "AWAY",
        startsOn: "2026-11-20",
        endsOn: "2026-11-20",
        note: "Vanguard",
      },
      {
        state: "AWAY",
        startsOn: "2026-11-24",
        endsOn: "2026-11-24",
        note: "Vanguard",
      },
    ]);
  });

  it("punches every selected day out of what was there, one span at a time", () => {
    const existing = [run("AROUND", "2026-11-01", "2026-11-30", null, "long")];
    const plan = setDays(existing, ["2026-11-10", "2026-11-20"], "AWAY", null);

    expect(plan.deleteIds).toEqual(["long"]);
    expect(resulting(existing, plan)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-01",
        endsOn: "2026-11-09",
        note: null,
      },
      {
        state: "AWAY",
        startsOn: "2026-11-10",
        endsOn: "2026-11-10",
        note: null,
      },
      {
        state: "AROUND",
        startsOn: "2026-11-11",
        endsOn: "2026-11-19",
        note: null,
      },
      {
        state: "AWAY",
        startsOn: "2026-11-20",
        endsOn: "2026-11-20",
        note: null,
      },
      {
        state: "AROUND",
        startsOn: "2026-11-21",
        endsOn: "2026-11-30",
        note: null,
      },
    ]);
  });

  it("merges a selection into a run it continues", () => {
    const existing = [run("AROUND", "2026-11-20", "2026-11-21", null, "mon")];
    const plan = setDays(existing, ["2026-11-22"], "AROUND", null);

    expect(plan.deleteIds).toEqual(["mon"]);
    expect(plan.create).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-22",
        note: null,
      },
    ]);
  });

  it("clears the selected days back to unsaid when the state is null", () => {
    // A hole, not a third state. The board draws those days as a gap, which is what it draws for
    // a day nobody has reached yet.
    const existing = [run("AROUND", "2026-11-01", "2026-11-30", null, "long")];
    const plan = setDays(existing, ["2026-11-10", "2026-11-11"], null, null);

    expect(resulting(existing, plan)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-01",
        endsOn: "2026-11-09",
        note: null,
      },
      {
        state: "AROUND",
        startsOn: "2026-11-12",
        endsOn: "2026-11-30",
        note: null,
      },
    ]);
  });

  it("keeps an open-ended run open when days are carved out of it", () => {
    const existing = [run("AWAY", "2026-09-01", null, "Vanguard", "term")];
    const plan = setDays(
      existing,
      ["2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"],
      "AROUND",
      null,
    );

    expect(resulting(existing, plan)).toEqual([
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

  it("is idempotent, because a double tap on a phone is ordinary", () => {
    const days = ["2026-11-20", "2026-11-21"];
    const first = setDays([], days, "AROUND", null);
    const existing = first.create.map((r, i) => ({ ...r, id: `new-${i}` }));
    const second = setDays(existing, days, "AROUND", null);

    expect(resulting(existing, second)).toEqual([
      {
        state: "AROUND",
        startsOn: "2026-11-20",
        endsOn: "2026-11-21",
        note: null,
      },
    ]);
  });

  it("does nothing at all when nothing is selected", () => {
    const existing = [run("AROUND", "2026-11-01", "2026-11-30", null, "long")];
    expect(setDays(existing, [], "AWAY", null)).toEqual({
      deleteIds: [],
      create: [],
    });
  });
});
