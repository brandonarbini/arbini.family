import { afterEach, describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDateFromDbDate,
  compareCalendarDates,
  dbDateFromCalendarDate,
  differenceInCalendarDays,
  eachCalendarDay,
  isCalendarDate,
  todayInFamilyTz,
} from "@/lib/dates";

// America/Los_Angeles in 2026: spring forward Mar 8, fall back Nov 1.
const SPRING_FORWARD = "2026-03-08";
const FALL_BACK = "2026-11-01";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe("todayInFamilyTz", () => {
  it("reports the family's day, not UTC's, when the two disagree", () => {
    // 05:30 UTC is still the previous evening in California. Formatting this instant in UTC —
    // the easy mistake — would put the whole board a day ahead for everyone.
    expect(todayInFamilyTz(new Date("2026-01-15T05:30:00Z"))).toBe(
      "2026-01-14",
    );
  });

  it("rolls over at local midnight", () => {
    expect(todayInFamilyTz(new Date("2026-01-15T07:59:59Z"))).toBe(
      "2026-01-14",
    );
    expect(todayInFamilyTz(new Date("2026-01-15T08:00:00Z"))).toBe(
      "2026-01-15",
    );
  });

  it("holds either side of the spring-forward transition", () => {
    // 09:59 UTC is 01:59 PST; 10:00 UTC is 03:00 PDT. The hour that never happened must not
    // advance the date.
    expect(todayInFamilyTz(new Date("2026-03-08T09:59:00Z"))).toBe(
      SPRING_FORWARD,
    );
    expect(todayInFamilyTz(new Date("2026-03-08T10:00:00Z"))).toBe(
      SPRING_FORWARD,
    );
  });

  it("holds either side of the fall-back transition", () => {
    // 08:00 and 09:00 UTC are both 01:00 local on this day — the repeated hour.
    expect(todayInFamilyTz(new Date("2026-11-01T08:00:00Z"))).toBe(FALL_BACK);
    expect(todayInFamilyTz(new Date("2026-11-01T09:00:00Z"))).toBe(FALL_BACK);
  });

  it("ignores the server's own timezone", () => {
    const instant = new Date("2026-01-15T05:30:00Z");
    for (const tz of [
      "UTC",
      "America/New_York",
      "Asia/Tokyo",
      "Pacific/Kiritimati",
    ]) {
      process.env.TZ = tz;
      expect(todayInFamilyTz(instant)).toBe("2026-01-14");
    }
  });
});

describe("isCalendarDate", () => {
  it("accepts real days", () => {
    expect(isCalendarDate("2026-01-15")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
  });

  it("rejects days that do not exist", () => {
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-00-10")).toBe(false);
  });

  it("rejects anything that is not a bare YYYY-MM-DD string", () => {
    expect(isCalendarDate("2026-1-5")).toBe(false);
    expect(isCalendarDate("2026-01-15T00:00:00Z")).toBe(false);
    expect(isCalendarDate(" 2026-01-15")).toBe(false);
    expect(isCalendarDate(20260115)).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
    expect(isCalendarDate(undefined)).toBe(false);
  });
});

describe("addCalendarDays", () => {
  it("crosses the spring-forward day without losing one", () => {
    // The failure this guards: 24-hour arithmetic on a local timestamp lands back on the same
    // calendar day when an hour goes missing, so "tomorrow" silently becomes "today".
    expect(addCalendarDays("2026-03-07", 1)).toBe(SPRING_FORWARD);
    expect(addCalendarDays(SPRING_FORWARD, 1)).toBe("2026-03-09");
    expect(addCalendarDays("2026-03-07", 3)).toBe("2026-03-10");
  });

  it("crosses the fall-back day without gaining one", () => {
    expect(addCalendarDays("2026-10-31", 1)).toBe(FALL_BACK);
    expect(addCalendarDays(FALL_BACK, 1)).toBe("2026-11-02");
    expect(addCalendarDays("2026-10-31", 3)).toBe("2026-11-03");
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("goes backwards and stands still", () => {
    expect(addCalendarDays("2026-03-09", -1)).toBe(SPRING_FORWARD);
    expect(addCalendarDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addCalendarDays("2026-01-15", 0)).toBe("2026-01-15");
  });

  it("ignores the server's own timezone", () => {
    for (const tz of [
      "UTC",
      "America/New_York",
      "Asia/Tokyo",
      "Pacific/Kiritimati",
    ]) {
      process.env.TZ = tz;
      expect(addCalendarDays("2026-03-07", 1)).toBe(SPRING_FORWARD);
      expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    }
  });

  it("rejects a malformed input rather than guessing", () => {
    expect(() => addCalendarDays("2026-02-30", 1)).toThrow(TypeError);
  });
});

describe("differenceInCalendarDays", () => {
  it("counts whole days across both DST transitions", () => {
    // 23- and 25-hour days must still count as one day each.
    expect(differenceInCalendarDays("2026-03-07", "2026-03-09")).toBe(2);
    expect(differenceInCalendarDays("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("is zero for the same day and negative going backwards", () => {
    expect(differenceInCalendarDays("2026-01-15", "2026-01-15")).toBe(0);
    expect(differenceInCalendarDays("2026-01-15", "2026-01-10")).toBe(-5);
  });

  it("spans a leap year correctly", () => {
    expect(differenceInCalendarDays("2028-01-01", "2029-01-01")).toBe(366);
  });
});

describe("eachCalendarDay", () => {
  it("is inclusive at both ends", () => {
    expect(eachCalendarDay("2026-03-07", "2026-03-09")).toEqual([
      "2026-03-07",
      SPRING_FORWARD,
      "2026-03-09",
    ]);
  });

  it("yields a single day when the bounds match", () => {
    expect(eachCalendarDay("2026-01-15", "2026-01-15")).toEqual(["2026-01-15"]);
  });

  it("yields nothing when the range runs backwards", () => {
    expect(eachCalendarDay("2026-01-15", "2026-01-14")).toEqual([]);
  });
});

describe("compareCalendarDates", () => {
  it("orders chronologically", () => {
    expect(compareCalendarDates("2026-01-14", "2026-01-15")).toBeLessThan(0);
    expect(compareCalendarDates("2026-01-15", "2026-01-14")).toBeGreaterThan(0);
    expect(compareCalendarDates("2026-01-15", "2026-01-15")).toBe(0);
  });

  it("sorts a list into calendar order", () => {
    const sorted = [
      "2026-11-02",
      "2026-01-15",
      "2027-01-01",
      "2026-01-14",
    ].sort(compareCalendarDates);
    expect(sorted).toEqual([
      "2026-01-14",
      "2026-01-15",
      "2026-11-02",
      "2027-01-01",
    ]);
  });
});

describe("Prisma @db.Date conversion", () => {
  it("reads a UTC-midnight column without shifting it back a day", () => {
    // The bug being pinned: formatting this instant in America/Los_Angeles yields 2026-01-14,
    // so every stay would render one day early for the whole family.
    expect(calendarDateFromDbDate(new Date("2026-01-15T00:00:00Z"))).toBe(
      "2026-01-15",
    );
  });

  it("writes UTC midnight", () => {
    expect(dbDateFromCalendarDate("2026-01-15").toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );
  });

  it("round-trips across DST transitions and timezones", () => {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = tz;
      for (const date of [
        SPRING_FORWARD,
        FALL_BACK,
        "2028-02-29",
        "2026-12-31",
      ]) {
        expect(calendarDateFromDbDate(dbDateFromCalendarDate(date))).toBe(date);
      }
    }
  });
});
