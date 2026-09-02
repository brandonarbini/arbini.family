import { describe, expect, it } from "vitest";
import { buildAgenda } from "@/lib/board/agenda";

const empty = { transitions: [], birthdays: [], events: [] };

describe("buildAgenda", () => {
  it("returns nothing when every source is empty", () => {
    expect(buildAgenda(empty)).toEqual([]);
  });

  it("interleaves the three sources chronologically", () => {
    // The point of the whole module: a birthday between two travel dates must land between them,
    // not in a separate block.
    const agenda = buildAgenda({
      transitions: [
        {
          kind: "arrival",
          date: "2026-04-10",
          profileId: "p1",
          placeId: "home",
        },
        {
          kind: "departure",
          date: "2026-04-25",
          profileId: "p1",
          placeId: "home",
        },
      ],
      birthdays: [{ profileId: "p2", date: "2026-04-18", turning: 16 }],
      events: [
        { id: "e1", date: "2026-04-30", title: "Graduation", note: null },
      ],
    });

    expect(agenda.map((entry) => entry.date)).toEqual([
      "2026-04-10",
      "2026-04-18",
      "2026-04-25",
      "2026-04-30",
    ]);
  });

  it("orders a shared day by kind: birthday, arrival, departure, event", () => {
    const agenda = buildAgenda({
      transitions: [
        {
          kind: "departure",
          date: "2026-04-10",
          profileId: "p1",
          placeId: "x",
        },
        { kind: "arrival", date: "2026-04-10", profileId: "p2", placeId: "x" },
      ],
      birthdays: [{ profileId: "p3", date: "2026-04-10", turning: 21 }],
      events: [{ id: "e1", date: "2026-04-10", title: "Dinner", note: null }],
    });

    expect(agenda.map((entry) => entry.kind)).toEqual([
      "birthday",
      "arrival",
      "departure",
      "event",
    ]);
  });

  it("breaks same-day, same-kind ties by identifier so the order is total", () => {
    // Two arrivals on one day must not swap between renders; the inputs come from separate
    // queries whose relative order is not guaranteed, so stability alone is not enough.
    const agenda = buildAgenda({
      ...empty,
      transitions: [
        { kind: "arrival", date: "2026-04-10", profileId: "zoe", placeId: "x" },
        { kind: "arrival", date: "2026-04-10", profileId: "abe", placeId: "x" },
      ],
    });

    expect(
      agenda.map((entry) => ("profileId" in entry ? entry.profileId : "")),
    ).toEqual(["abe", "zoe"]);
  });

  it("produces the same list regardless of input order", () => {
    const sources = {
      transitions: [
        {
          kind: "arrival" as const,
          date: "2026-04-10",
          profileId: "p1",
          placeId: "x",
        },
      ],
      birthdays: [{ profileId: "p2", date: "2026-04-10", turning: 16 }],
      events: [{ id: "e1", date: "2026-04-10", title: "Dinner", note: null }],
    };

    const forward = buildAgenda(sources);
    const reversed = buildAgenda({
      transitions: [...sources.transitions].reverse(),
      birthdays: [...sources.birthdays].reverse(),
      events: [...sources.events].reverse(),
    });

    expect(reversed).toEqual(forward);
  });

  it("carries each entry's own fields through", () => {
    const agenda = buildAgenda({
      ...empty,
      birthdays: [{ profileId: "p2", date: "2026-04-18", turning: 16 }],
      events: [
        { id: "e1", date: "2026-04-19", title: "Graduation", note: "2pm" },
      ],
    });

    expect(agenda).toEqual([
      { kind: "birthday", date: "2026-04-18", profileId: "p2", turning: 16 },
      {
        kind: "event",
        date: "2026-04-19",
        eventId: "e1",
        title: "Graduation",
        note: "2pm",
      },
    ]);
  });

  it("does not mutate its inputs", () => {
    const transitions = [
      {
        kind: "arrival" as const,
        date: "2026-04-20",
        profileId: "p1",
        placeId: "x",
      },
      {
        kind: "arrival" as const,
        date: "2026-04-10",
        profileId: "p2",
        placeId: "x",
      },
    ];
    buildAgenda({ ...empty, transitions });
    expect(transitions[0].date).toBe("2026-04-20");
  });
});
