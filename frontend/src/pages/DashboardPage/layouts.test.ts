import { describe, expect, it } from "vitest";
import type { DashboardWidgetId } from "../../api/settings";
import { PUZZLE_COLUMNS, puzzlePieces } from "./layouts";

// What the browser's dense grid packing does: each piece takes the first spot it fits, from the top.
function pack(pieces: { columns: number; rows: number }[]) {
  const taken = new Set<string>();
  let height = 0;
  for (const { columns, rows } of pieces) {
    for (let row = 0, placed = false; !placed; row++) {
      for (let col = 0; col + columns <= PUZZLE_COLUMNS && !placed; col++) {
        const cells = Array.from(
          { length: rows * columns },
          (_, i) => `${row + Math.floor(i / columns)},${col + (i % columns)}`,
        );
        if (cells.some((cell) => taken.has(cell))) continue;
        cells.forEach((cell) => taken.add(cell));
        height = Math.max(height, row + rows);
        placed = true;
      }
    }
  }
  return { height, holes: height * PUZZLE_COLUMNS - taken.size };
}

const BASE: DashboardWidgetId[] = [
  "collectionCount",
  "modelCount",
  "authorCount",
  "categoryCount",
  "topViewed",
  "topPrinted",
  "recentlyAdded",
  "topAuthors",
  "topProviders",
];
const EXTRAS: DashboardWidgetId[] = ["clock", "weather", "featuredModel", "activityHeatmap"];

describe("puzzle layout", () => {
  // The extras come as a block of three rows, so they fit exactly when all or none are shown. The
  // heatmap is a whole row of its own, so it fits on its own too.
  it.each([
    ["no extras", []],
    ["every extra", EXTRAS],
    ["only the activity heatmap", ["activityHeatmap"]],
  ])("packs the default boxes with %s and leaves no holes", (_, extras) => {
    const pieces = puzzlePieces([...BASE, ...(extras as DashboardWidgetId[])].map((id) => ({ id })));
    expect(pieces).toHaveLength(BASE.length + (extras as DashboardWidgetId[]).length);
    expect(pack(pieces).holes).toBe(0);
  });
});
