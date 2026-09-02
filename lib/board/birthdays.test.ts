import { describe, expect, it } from "vitest";
import {
  nextBirthdayOccurrence,
  upcomingBirthdays,
} from "@/lib/board/birthdays";

describe("nextBirthdayOccurrence", () => {
  it("returns this year's date when it is still ahead", () => {
    expect(nextBirthdayOccurrence("1978-04-12", "2026-01-01")).toBe(
      "2026-04-12",
    );
  });

  it("returns today when the birthday is today", () => {
    // The one day the board most wants to shout about; rolling it forward a year would make it
    // the single day of the year this is wrong.
    expect(nextBirthdayOccurrence("1978-04-12", "2026-04-12")).toBe(
      "2026-04-12",
    );
  });

  it("rolls into next year once the date has passed", () => {
    expect(nextBirthdayOccurrence("1978-04-12", "2026-04-13")).toBe(
      "2027-04-12",
    );
  });

  it("crosses the turn of the year", () => {
    expect(nextBirthdayOccurrence("2011-01-05", "2026-12-20")).toBe(
      "2027-01-05",
    );
  });

  it("observes 29 February on the 28th in a common year", () => {
    expect(nextBirthdayOccurrence("2004-02-29", "2026-01-01")).toBe(
      "2026-02-28",
    );
  });

  it("observes 29 February on the day itself in a leap year", () => {
    expect(nextBirthdayOccurrence("2004-02-29", "2028-01-01")).toBe(
      "2028-02-29",
    );
  });

  it("never skips a 29 February birthday, in any of four consecutive years", () => {
    // The failure this guards against is a naive implementation that emits an invalid 29 February
    // in common years and drops it entirely.
    for (const year of [2025, 2026, 2027, 2028]) {
      const observed = nextBirthdayOccurrence("2004-02-29", `${year}-01-01`);
      expect(observed.startsWith(String(year))).toBe(true);
    }
  });

  it("treats 2100 as a common year", () => {
    // Divisible by 4 but not 400. A `year % 4` shortcut passes every test above and fails here.
    expect(nextBirthdayOccurrence("2004-02-29", "2100-01-01")).toBe(
      "2100-02-28",
    );
  });
});

describe("upcomingBirthdays", () => {
  const people = [
    { profileId: "dad", birthday: "1978-04-12" },
    { profileId: "kid", birthday: "2011-04-20" },
    { profileId: "far", birthday: "2004-11-02" },
  ];

  it("includes only birthdays inside the window", () => {
    const result = upcomingBirthdays(people, "2026-04-01", 30);
    expect(result.map((b) => b.profileId)).toEqual(["dad", "kid"]);
  });

  it("includes a birthday on the last day of the window", () => {
    // Inclusive at both ends, matching upcomingTransitions — the two render into one list.
    const result = upcomingBirthdays(people, "2026-04-01", 11);
    expect(result.map((b) => b.profileId)).toEqual(["dad"]);
  });

  it("excludes a birthday one day past the window", () => {
    expect(upcomingBirthdays(people, "2026-04-01", 10)).toEqual([]);
  });

  it("reports the age being reached", () => {
    const [dad] = upcomingBirthdays(people, "2026-04-01", 30);
    expect(dad.turning).toBe(48);
  });

  it("reports the true age for a 29 February birthday observed on the 28th", () => {
    const result = upcomingBirthdays(
      [{ profileId: "leap", birthday: "2004-02-29" }],
      "2026-02-01",
      30,
    );
    expect(result[0]).toEqual({
      profileId: "leap",
      date: "2026-02-28",
      turning: 22,
    });
  });

  it("orders by date, then by profile for a shared day", () => {
    const twins = [
      { profileId: "b-twin", birthday: "2011-04-20" },
      { profileId: "a-twin", birthday: "2011-04-20" },
    ];
    expect(
      upcomingBirthdays(twins, "2026-04-01", 30).map((b) => b.profileId),
    ).toEqual(["a-twin", "b-twin"]);
  });

  it("returns nothing for a negative window rather than scanning backwards", () => {
    expect(upcomingBirthdays(people, "2026-04-01", -1)).toEqual([]);
  });

  it("spans a year boundary inside the window", () => {
    const result = upcomingBirthdays(
      [{ profileId: "ny", birthday: "2011-01-05" }],
      "2026-12-20",
      30,
    );
    expect(result[0]?.date).toBe("2027-01-05");
  });
});
