import { describe, expect, it } from "vitest";
import {
  type StayWindow,
  findNextGathering,
  locationsOn,
  stayCoversDate,
  upcomingTransitions,
} from "@/lib/presence";

const HOME = "place-home";
const GRANDMA = "place-grandma";
const SCHOOL = "place-school";

const FAMILY = ["brandon", "kim", "tanner", "ellie", "nico"];

function stay(
  profileId: string,
  placeId: string,
  startsOn: string,
  endsOn: string | null,
): StayWindow {
  return { profileId, placeId, startsOn, endsOn };
}

/** Everyone at one place for a single window — the base the gathering tests perturb. */
function allAt(placeId: string, startsOn: string, endsOn: string | null) {
  return FAMILY.map((profileId) => stay(profileId, placeId, startsOn, endsOn));
}

describe("stayCoversDate", () => {
  it("treats endsOn as the last day at the place, not the day of departure", () => {
    const s = stay("ellie", HOME, "2026-11-20", "2026-11-29");
    expect(stayCoversDate(s, "2026-11-29")).toBe(true);
    expect(stayCoversDate(s, "2026-11-30")).toBe(false);
  });

  it("includes the first day", () => {
    const s = stay("ellie", HOME, "2026-11-20", "2026-11-29");
    expect(stayCoversDate(s, "2026-11-20")).toBe(true);
    expect(stayCoversDate(s, "2026-11-19")).toBe(false);
  });

  it("covers a single-night stay written with matching dates", () => {
    const s = stay("ellie", GRANDMA, "2026-11-20", "2026-11-20");
    expect(stayCoversDate(s, "2026-11-20")).toBe(true);
    expect(stayCoversDate(s, "2026-11-21")).toBe(false);
  });

  it("runs forever when open-ended", () => {
    const s = stay("nico", HOME, "2026-01-01", null);
    expect(stayCoversDate(s, "2030-06-01")).toBe(true);
    expect(stayCoversDate(s, "2025-12-31")).toBe(false);
  });
});

describe("locationsOn", () => {
  it("reports null for a person with nothing recorded", () => {
    const places = locationsOn(
      [stay("ellie", HOME, "2026-11-20", null)],
      FAMILY,
      "2026-11-21",
    );
    expect(places.get("ellie")).toBe(HOME);
    expect(places.get("tanner")).toBeNull();
  });

  it("returns an entry for every requested profile, in order", () => {
    const places = locationsOn([], FAMILY, "2026-11-21");
    expect([...places.keys()]).toEqual(FAMILY);
  });

  it("ignores profiles that were not asked for", () => {
    const places = locationsOn(
      [stay("cousin", HOME, "2026-11-20", null)],
      ["ellie"],
      "2026-11-21",
    );
    expect([...places.keys()]).toEqual(["ellie"]);
  });

  it("prefers the most recently started stay when two overlap", () => {
    // A data error the form should prevent, but the board still has to render something.
    const stays = [
      stay("tanner", SCHOOL, "2026-09-01", "2026-12-15"),
      stay("tanner", HOME, "2026-11-20", "2026-11-29"),
    ];
    expect(locationsOn(stays, ["tanner"], "2026-11-25").get("tanner")).toBe(
      HOME,
    );
  });

  it("breaks an exact startsOn tie with the later entry", () => {
    const stays = [
      stay("tanner", SCHOOL, "2026-11-20", "2026-11-29"),
      stay("tanner", HOME, "2026-11-20", "2026-11-29"),
    ];
    expect(locationsOn(stays, ["tanner"], "2026-11-25").get("tanner")).toBe(
      HOME,
    );
  });
});

describe("findNextGathering", () => {
  it("finds the day everyone is finally at the same place", () => {
    expect(
      findNextGathering(
        allAt(HOME, "2026-11-25", "2026-11-29"),
        FAMILY,
        "2026-11-01",
      ),
    ).toEqual({ date: "2026-11-25", placeId: HOME });
  });

  it("counts a gathering anywhere, not just at home", () => {
    // Thanksgiving at Grandma's is the family being together; a home-only check would miss the
    // one occasion people care most about.
    expect(
      findNextGathering(
        allAt(GRANDMA, "2026-11-26", "2026-11-27"),
        FAMILY,
        "2026-11-01",
      ),
    ).toEqual({ date: "2026-11-26", placeId: GRANDMA });
  });

  it("returns the earliest qualifying day when several qualify", () => {
    const stays = [
      ...allAt(HOME, "2026-11-25", "2026-11-29"),
      ...allAt(HOME, "2026-12-24", "2026-12-26"),
    ];
    expect(findNextGathering(stays, FAMILY, "2026-11-01")?.date).toBe(
      "2026-11-25",
    );
  });

  it("requires everyone, not a majority", () => {
    const stays = allAt(HOME, "2026-11-25", "2026-11-29").filter(
      (s) => s.profileId !== "tanner",
    );
    expect(findNextGathering(stays, FAMILY, "2026-11-01")).toBeNull();
  });

  it("does not count everyone being somewhere on the same day at different places", () => {
    const stays = [
      ...allAt(HOME, "2026-11-25", "2026-11-29").filter(
        (s) => s.profileId !== "tanner",
      ),
      stay("tanner", SCHOOL, "2026-11-25", "2026-11-29"),
    ];
    expect(findNextGathering(stays, FAMILY, "2026-11-01")).toBeNull();
  });

  it("returns null when nobody overlaps at all", () => {
    const stays = FAMILY.map((profileId, index) =>
      stay(profileId, HOME, `2026-11-0${index + 1}`, `2026-11-0${index + 1}`),
    );
    expect(findNextGathering(stays, FAMILY, "2026-11-01")).toBeNull();
  });

  it("returns null for an empty family rather than reporting a vacuous gathering", () => {
    // "Every profile is at the same place" is trivially true of nobody, which would render a
    // countdown to today on a board with no people on it. Pins the behaviour, not one particular
    // guard — findNextGathering declines this twice over, deliberately.
    expect(
      findNextGathering(
        allAt(HOME, "2026-11-25", "2026-11-29"),
        [],
        "2026-11-01",
      ),
    ).toBeNull();
  });

  it("counts today itself as a gathering when everyone is already together", () => {
    expect(
      findNextGathering(
        allAt(HOME, "2026-11-01", "2026-11-29"),
        FAMILY,
        "2026-11-01",
      )?.date,
    ).toBe("2026-11-01");
  });

  it("honours open-ended stays", () => {
    expect(
      findNextGathering(allAt(HOME, "2026-11-25", null), FAMILY, "2026-11-01")
        ?.date,
    ).toBe("2026-11-25");
  });

  it("looks no further than the horizon", () => {
    const stays = allAt(HOME, "2026-12-24", "2026-12-26");
    // 2026-11-01 + 53 days is 2026-12-24 exactly; one day short must miss it.
    expect(findNextGathering(stays, FAMILY, "2026-11-01", 53)?.date).toBe(
      "2026-12-24",
    );
    expect(findNextGathering(stays, FAMILY, "2026-11-01", 52)).toBeNull();
  });

  it("never looks backwards", () => {
    expect(
      findNextGathering(
        allAt(HOME, "2026-01-01", "2026-01-05"),
        FAMILY,
        "2026-11-01",
      ),
    ).toBeNull();
  });

  it("spans a DST transition without skipping the qualifying day", () => {
    expect(
      findNextGathering(
        allAt(HOME, "2026-03-08", "2026-03-08"),
        FAMILY,
        "2026-03-01",
      )?.date,
    ).toBe("2026-03-08");
  });
});

describe("upcomingTransitions", () => {
  const stays = [
    stay("ellie", HOME, "2026-11-20", "2026-11-29"),
    stay("tanner", HOME, "2026-11-25", "2026-11-27"),
    stay("nico", HOME, "2026-01-01", null),
  ];

  it("reports arrivals and departures inside the window, earliest first", () => {
    expect(upcomingTransitions(stays, "2026-11-19", 15)).toEqual([
      {
        kind: "arrival",
        date: "2026-11-20",
        profileId: "ellie",
        placeId: HOME,
      },
      {
        kind: "arrival",
        date: "2026-11-25",
        profileId: "tanner",
        placeId: HOME,
      },
      {
        kind: "departure",
        date: "2026-11-27",
        profileId: "tanner",
        placeId: HOME,
      },
      {
        kind: "departure",
        date: "2026-11-29",
        profileId: "ellie",
        placeId: HOME,
      },
    ]);
  });

  it("gives an open-ended stay an arrival and no departure", () => {
    // Inventing a departure date for someone who has not said when they leave would put a wrong
    // date on the board rather than no date.
    const transitions = upcomingTransitions([stays[2]], "2026-01-01", 30);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].kind).toBe("arrival");
  });

  it("includes both window boundaries", () => {
    const one = [stay("ellie", HOME, "2026-11-20", "2026-11-30")];
    expect(upcomingTransitions(one, "2026-11-20", 10)).toHaveLength(2);
    expect(upcomingTransitions(one, "2026-11-21", 8)).toHaveLength(0);
  });

  it("excludes events already past", () => {
    expect(upcomingTransitions(stays, "2026-11-28", 30)).toEqual([
      {
        kind: "departure",
        date: "2026-11-29",
        profileId: "ellie",
        placeId: HOME,
      },
    ]);
  });

  it("orders same-day events deterministically", () => {
    // Two people arriving on one day must not swap places between renders.
    const sameDay = [
      stay("tanner", HOME, "2026-11-25", null),
      stay("ellie", HOME, "2026-11-25", null),
    ];
    const first = upcomingTransitions(sameDay, "2026-11-01", 30);
    const second = upcomingTransitions(
      [...sameDay].reverse(),
      "2026-11-01",
      30,
    );
    expect(first).toEqual(second);
    expect(first.map((t) => t.profileId)).toEqual(["ellie", "tanner"]);
  });
});

/**
 * The declared-default fallback.
 *
 * The tests above pass `defaults` nowhere, which is the point: they are the proof the parameter is
 * genuinely optional and that adding it changed nothing for callers that do not use it.
 */
describe("declared defaults", () => {
  const livesAt = (overrides: Record<string, string | null> = {}) =>
    new Map<string, string | null>(
      FAMILY.map((profileId) => [
        profileId,
        profileId in overrides ? overrides[profileId] : HOME,
      ]),
    );

  it("places someone at their default on a day no stay covers", () => {
    const places = locationsOn([], FAMILY, "2026-11-20", livesAt());
    expect(places.get("ellie")).toBe(HOME);
  });

  it("lets a covering stay beat the default", () => {
    // Being somewhere is a statement about a specific day; a default is a statement about
    // ordinary ones, so the specific one has to win or a recorded trip would be invisible.
    const places = locationsOn(
      [stay("ellie", GRANDMA, "2026-11-20", "2026-11-22")],
      FAMILY,
      "2026-11-21",
      livesAt(),
    );
    expect(places.get("ellie")).toBe(GRANDMA);
    expect(places.get("nico")).toBe(HOME);
  });

  it("falls back to the default again once the stay ends", () => {
    const stays = [stay("ellie", GRANDMA, "2026-11-20", "2026-11-22")];
    expect(
      locationsOn(stays, FAMILY, "2026-11-23", livesAt()).get("ellie"),
    ).toBe(HOME);
  });

  it("still reports null for someone with no declared home", () => {
    // The whole distinction this feature rests on: a person who has not said where they live is
    // unknown, not assumed to be anywhere. Only a *declared* default resolves.
    const places = locationsOn(
      [],
      FAMILY,
      "2026-11-20",
      livesAt({ nico: null }),
    );
    expect(places.get("nico")).toBeNull();
    expect(places.get("ellie")).toBe(HOME);
  });

  it("finds no gathering while one person lives somewhere else", () => {
    // Four at home and Addison on campus: the board's resting state, and correctly not a
    // gathering. A default that resolved everyone to home would report one every single day.
    expect(
      findNextGathering(
        [],
        FAMILY,
        "2026-11-20",
        30,
        livesAt({ ellie: SCHOOL }),
      ),
    ).toBeNull();
  });

  it("finds the gathering on the day the one away person comes home", () => {
    expect(
      findNextGathering(
        [stay("ellie", HOME, "2026-11-25", "2026-11-29")],
        FAMILY,
        "2026-11-20",
        30,
        livesAt({ ellie: SCHOOL }),
      ),
    ).toEqual({ date: "2026-11-25", placeId: HOME });
  });

  it("still declines to report a gathering while anybody is unknown", () => {
    // `null` default plus no stay is a gap in the data, and a countdown built on a gap is wrong
    // in exactly the case somebody would act on it.
    expect(
      findNextGathering([], FAMILY, "2026-11-20", 30, livesAt({ nico: null })),
    ).toBeNull();
  });
});

describe("upcomingTransitions on a single day", () => {
  it("reports an arrival and no departure for a day visit", () => {
    // Settling a poll writes a stay with matching dates for whoever has to travel, so this is the
    // ordinary shape now. Two lines for one visit reads as a glitch.
    expect(
      upcomingTransitions(
        [stay("ellie", HOME, "2026-11-20", "2026-11-20")],
        "2026-11-18",
        30,
      ),
    ).toEqual([
      {
        kind: "arrival",
        date: "2026-11-20",
        profileId: "ellie",
        placeId: HOME,
      },
    ]);
  });

  it("still reports both ends of a stay longer than a day", () => {
    expect(
      upcomingTransitions(
        [stay("ellie", HOME, "2026-11-20", "2026-11-21")],
        "2026-11-18",
        30,
      ).map((transition) => transition.kind),
    ).toEqual(["arrival", "departure"]);
  });
});
