import { describe, expect, it } from "vitest";
import { addDays, buildWeeks, lastYearRange, level, localToday, monthStarts, weekday, yearRange } from "./calendar";

describe("ranges", () => {
  it("makes the last year end today and start the day after a year ago", () => {
    expect(lastYearRange("2026-10-07")).toEqual({ from: "2025-10-08", to: "2026-10-07" });
    expect(lastYearRange("2028-02-29")).toEqual({ from: "2027-03-02", to: "2028-02-29" });
  });

  it("spans a whole year", () => {
    expect(yearRange(2026)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("steps over month and DST boundaries by whole days", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("reads today in local time", () => {
    expect(localToday(new Date(2026, 9, 7, 23, 59))).toBe("2026-10-07");
  });
});

const inRange = (week: { inRange: boolean }[]) => week.map((cell) => cell.inRange);

describe("buildWeeks", () => {
  const weeks = buildWeeks(yearRange(2026), 0);

  it("gives every day of the year exactly once, in order", () => {
    const days = weeks
      .flat()
      .filter((cell) => cell.inRange)
      .map((cell) => cell.date);
    expect(days).toHaveLength(365);
    expect(days[0]).toBe("2026-01-01");
    expect(days.at(-1)).toBe("2026-12-31");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("starts each column on the chosen weekday, padding the first week", () => {
    // 1 January 2026 is a Thursday.
    expect(weekday("2026-01-01")).toBe(4);
    expect(inRange(weeks[0])).toEqual([false, false, false, false, true, true, true]);
    expect(weeks[0][0].date).toBe("2025-12-28");
    expect(inRange(buildWeeks(yearRange(2026), 1)[0])).toEqual([false, false, false, true, true, true, true]);
  });
});

describe("monthStarts", () => {
  it("labels each month once, at its first week", () => {
    const starts = monthStarts(buildWeeks(yearRange(2026), 0));
    expect(starts.map((s) => s.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(starts[0].column).toBe(0);
  });

  it("drops a label with no room before the next one or the edge", () => {
    // 8 October 2025 to 7 October 2026: October starts both ends, each only briefly.
    const starts = monthStarts(buildWeeks({ from: "2025-10-08", to: "2026-10-07" }, 0));
    expect(starts[0].month).toBe(9);
    expect(starts.at(-1)?.month).toBe(8);
  });
});

describe("level", () => {
  it("is 0 without activity and 4 on the busiest day", () => {
    expect(level(0, 10)).toBe(0);
    expect(level(1, 10)).toBe(1);
    expect(level(5, 10)).toBe(2);
    expect(level(10, 10)).toBe(4);
  });
});
