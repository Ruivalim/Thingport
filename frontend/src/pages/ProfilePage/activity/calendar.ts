// Date arithmetic for the heatmap, on YYYY-MM-DD strings in UTC so no time zone or DST shift can
// move a day. "Today" comes from the caller, in the viewer's own zone.

const DAY_MS = 86_400_000;

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The viewer's date today, in their own time zone. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type DateRange = { from: string; to: string };

/** The year up to and including today. */
export function lastYearRange(today: string): DateRange {
  const [y, m, d] = today.split("-").map(Number);
  return { from: addDays(toIso(new Date(Date.UTC(y - 1, m - 1, d))), 1), to: today };
}

export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
  return toDate(iso).getUTCDay();
}

export type Cell = { date: string; inRange: boolean };

/**
 * The range as columns of 7 days, the first column starting on `weekStart`. The first and last
 * weeks are filled out with the days around the range, marked out of range.
 */
export function buildWeeks(range: DateRange, weekStart: 0 | 1): Cell[][] {
  const lead = (weekday(range.from) - weekStart + 7) % 7;
  const weeks: Cell[][] = [];
  let date = addDays(range.from, -lead);
  while (date <= range.to) {
    const week: Cell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date, inRange: date >= range.from && date <= range.to });
      date = addDays(date, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// A label needs this many columns before the next one (or the edge), as on GitHub; a month that
// barely starts in the range goes unlabelled rather than overlapping.
const MIN_LABEL_COLUMNS = 3;

/** Where each month's label goes: the first week holding a day of it, by column index. */
export function monthStarts(weeks: Cell[][]): { column: number; month: number }[] {
  const out: { column: number; month: number }[] = [];
  weeks.forEach((week, column) => {
    const first = week.find((cell) => cell.inRange);
    if (!first) return;
    const month = toDate(first.date).getUTCMonth();
    if (out.at(-1)?.month !== month) out.push({ column, month });
  });
  return out.filter((start, i) => (out[i + 1]?.column ?? weeks.length) - start.column >= MIN_LABEL_COLUMNS);
}

/** 0 for no activity, then 1-4 by share of the busiest day, as GitHub shades its graph. */
export function level(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((count / max) * 4)) as 1 | 2 | 3 | 4;
}
