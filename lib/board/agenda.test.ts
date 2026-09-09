import { describe, expect, it } from "vitest";
import { buildAgenda } from "@/lib/board/agenda";

const empty = { birthdays: [], events: [] };

describe("buildAgenda", () => {
  it("returns nothing when every source is empty", () => {
    expect(buildAgenda(empty)).toEqual([]);
  });

  it("interleaves the two sources chronologically", () => {
    // The point of the whole module: a birthday between two dated events must land between them,
    // not in a separate block.
    const agenda = buildAgenda({
      birthdays: [{ profileId: "p2", date: "2026-04-18", turning: 16 }],
      events: [
        { id: "e1", date: "2026-04-30", title: "Graduation", note: null },
        { id: "e2", date: "2026-04-10", title: "Camping", note: null },
      ],
    });

    expect(agenda.map((entry) => entry.date)).toEqual([
      "2026-04-10",
      "2026-04-18",
      "2026-04-30",
    ]);
  });

  it("puts a birthday before an event on a day they share", () => {
    const agenda = buildAgenda({
      birthdays: [{ profileId: "p2", date: "2026-04-10", turning: 16 }],
      events: [
        { id: "e1", date: "2026-04-10", title: "Graduation", note: null },
      ],
    });
    expect(agenda.map((entry) => entry.kind)).toEqual(["birthday", "event"]);
  });

  it("is a total order, so a re-fetch cannot reshuffle a day", () => {
    // The three sources come from separate queries whose relative order is not guaranteed, and a
    // list that reordered itself between renders would read as the board changing when nothing
    // has.
    const sources = {
      birthdays: [
        { profileId: "p3", date: "2026-04-10", turning: 16 },
        { profileId: "p1", date: "2026-04-10", turning: 40 },
      ],
      events: [
        { id: "e2", date: "2026-04-10", title: "Second", note: null },
        { id: "e1", date: "2026-04-10", title: "First", note: null },
      ],
    };

    const forward = buildAgenda(sources);
    const reversed = buildAgenda({
      birthdays: [...sources.birthdays].reverse(),
      events: [...sources.events].reverse(),
    });

    expect(forward).toEqual(reversed);
    expect(forward.map((entry) => entry.kind)).toEqual([
      "birthday",
      "birthday",
      "event",
      "event",
    ]);
  });

  it("carries each entry's own fields through untouched", () => {
    const agenda = buildAgenda({
      birthdays: [{ profileId: "p2", date: "2026-04-18", turning: 16 }],
      events: [
        { id: "e1", date: "2026-04-30", title: "Graduation", note: "at 2pm" },
      ],
    });

    expect(agenda[0]).toEqual({
      kind: "birthday",
      date: "2026-04-18",
      profileId: "p2",
      turning: 16,
    });
    expect(agenda[1]).toEqual({
      kind: "event",
      date: "2026-04-30",
      eventId: "e1",
      title: "Graduation",
      note: "at 2pm",
    });
  });
});
