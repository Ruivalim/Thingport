import { describe, expect, it } from "vitest";
import { easterSunday, equinox, seasonFor } from "./season";

const on = (year: number, month: number, day: number) => seasonFor(new Date(year, month - 1, day, 12));
const minutesOff = (date: Date, iso: string) => Math.abs(date.getTime() - Date.parse(iso)) / 60_000;
const dayAfter = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12);

describe("seasonFor", () => {
  it("knows Easter Sunday in years it moves around", () => {
    expect(easterSunday(2025).toDateString()).toBe(new Date(2025, 3, 20).toDateString());
    expect(easterSunday(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString());
    expect(easterSunday(2027).toDateString()).toBe(new Date(2027, 2, 28).toDateString());
  });

  it("is Easter from Good Friday to Easter Monday", () => {
    expect(on(2027, 3, 25)).toBeNull();
    expect(on(2027, 3, 26)).toBe("easter");
    expect(on(2027, 3, 29)).toBe("easter");
    expect(on(2027, 3, 30)).toBeNull();
  });

  it("is Christmas from 18 December to the year's end, and New Year for its first two days", () => {
    expect(on(2026, 12, 17)).toBeNull();
    expect(on(2026, 12, 18)).toBe("christmas");
    expect(on(2026, 12, 31)).toBe("christmas");
    expect(on(2027, 1, 1)).toBe("newYear");
    expect(on(2027, 1, 2)).toBe("newYear");
    expect(on(2027, 1, 3)).toBeNull();
  });

  it("knows the one-day ones", () => {
    expect(on(2027, 2, 14)).toBe("valentines");
    expect(on(2027, 3, 8)).toBe("womensDay");
    expect(on(2027, 3, 17)).toBe("stPatricks");
    expect(on(2027, 4, 1)).toBe("aprilFools");
    expect(on(2027, 9, 7)).toBe("birthday");
    expect(on(2027, 10, 1)).toBe("coffee");
    expect(on(2027, 6, 10)).toBe("saltibarsciai");
  });

  it("puts Programmers' Day on the 256th day, a day earlier in a leap year", () => {
    expect(on(2027, 9, 13)).toBe("programmersDay");
    expect(on(2027, 9, 12)).toBeNull();
    expect(on(2028, 9, 12)).toBe("programmersDay");
    expect(on(2028, 9, 13)).toBeNull();
  });

  it("is Halloween for its last three days of October, then the Day of the Dead", () => {
    expect(on(2026, 10, 28)).toBeNull();
    expect(on(2026, 10, 29)).toBe("halloween");
    expect(on(2026, 10, 31)).toBe("halloween");
    expect(on(2026, 11, 1)).toBe("muertos");
    expect(on(2026, 11, 2)).toBe("muertos");
    expect(on(2026, 11, 3)).toBeNull();
  });

  it("is Joninės on its eve and its day", () => {
    expect(on(2027, 6, 23)).toBe("jonines");
    expect(on(2027, 6, 24)).toBe("jonines");
    expect(on(2027, 6, 25)).toBeNull();
  });

  it("finds the lunar ones in their tables", () => {
    expect(on(2027, 2, 6)).toBe("lunarNewYear");
    expect(on(2027, 2, 7)).toBe("lunarNewYear");
    expect(on(2027, 3, 21)).toBe("holi");
    expect(on(2027, 3, 22)).toBe("holi");
    expect(on(2026, 11, 8)).toBe("diwali");
    expect(on(2026, 12, 4)).toBe("hanukkah");
    expect(on(2026, 12, 11)).toBe("hanukkah");
    expect(on(2026, 12, 12)).toBeNull();
  });

  it("marks Ramadan's first day and Eid on either day it may fall", () => {
    expect(on(2027, 2, 8)).toBe("ramadan");
    expect(on(2027, 2, 9)).toBeNull();
    expect(on(2027, 3, 9)).toBe("ramadan");
    expect(on(2027, 3, 10)).toBe("ramadan");
    expect(on(2027, 3, 11)).toBeNull();
  });

  it("puts the equinoxes and solstices within minutes of when they happen", () => {
    expect(minutesOff(equinox(2026, "march"), "2026-03-20T14:46Z")).toBeLessThan(15);
    expect(minutesOff(equinox(2026, "june"), "2026-06-21T08:24Z")).toBeLessThan(15);
    expect(minutesOff(equinox(2026, "september"), "2026-09-23T00:05Z")).toBeLessThan(15);
    expect(minutesOff(equinox(2026, "december"), "2026-12-21T20:50Z")).toBeLessThan(15);
  });

  it("shows each season's first day on the user's own calendar day of it", () => {
    for (const [which, season] of [
      ["june", "summer"],
      ["september", "autumn"],
    ] as const) {
      const moment = equinox(2027, which);
      expect(seasonFor(moment)).toBe(season);
      // Not null: east of UTC, the June solstice's day after can already be Joninės.
      expect(seasonFor(dayAfter(moment))).not.toBe(season);
    }
  });

  it("lets a holiday win over a longer or minor one on the same day", () => {
    // Christmas Eve over the first day of Hanukkah 2027, then Hanukkah over the days after Christmas.
    expect(on(2027, 12, 24)).toBe("christmas");
    expect(on(2027, 12, 28)).toBe("hanukkah");
    // Diwali over Halloween; Eid over the March equinox, both on 20 March 2026.
    expect(on(2027, 10, 29)).toBe("diwali");
    expect(on(2026, 3, 20)).toBe("ramadan");
    // The winter solstice through the days before Christmas.
    expect(seasonFor(equinox(2026, "december"))).toBe("winter");
  });

  it("is an ordinary day otherwise", () => {
    expect(on(2026, 10, 14)).toBeNull();
  });
});
