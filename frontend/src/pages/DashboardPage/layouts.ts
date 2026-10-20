import type { DashboardLayout, DashboardWidgetId } from "../../api/settings";
import type { DashboardWidget } from "./widgets";

export type LayoutDefinition = {
  id: DashboardLayout;
  /** Where the count boxes (the widgets in column 0) sit; "mixed" fits every box together as a puzzle. */
  counts: "left" | "right" | "top" | "bottom" | "mixed";
  /** How many columns the larger panels share. Unused by the puzzle. */
  columns: 1 | 2 | 3;
};

/** In the order the picker shows them; the first is the default. */
export const DASHBOARD_LAYOUTS: LayoutDefinition[] = [
  { id: "left", counts: "left", columns: 2 },
  { id: "top", counts: "top", columns: 3 },
  { id: "right", counts: "right", columns: 2 },
  { id: "bottom", counts: "bottom", columns: 3 },
  { id: "topTwo", counts: "top", columns: 2 },
  { id: "puzzle", counts: "mixed", columns: 1 },
];

export function layoutDefinition(id: DashboardLayout): LayoutDefinition {
  return DASHBOARD_LAYOUTS.find((layout) => layout.id === id) ?? DASHBOARD_LAYOUTS[0];
}

/** Splits the enabled panels into the layout's columns. Empty columns are dropped, so the rest widen. */
export function panelColumns(layout: LayoutDefinition, panels: DashboardWidget[]): DashboardWidget[][] {
  let columns: DashboardWidget[][];
  if (layout.columns === 1) columns = [panels];
  // Two columns keep each widget's own column.
  else if (layout.columns === 2) columns = [1, 2].map((column) => panels.filter((widget) => widget.column === column));
  // Three are filled across, so the first row holds the first three panels.
  else columns = [0, 1, 2].map((index) => panels.filter((_, position) => position % 3 === index));
  return columns.filter((column) => column.length > 0);
}

/** The puzzle's grid width on a wide screen; on smaller ones pieces shrink to fit two columns, then one. */
export const PUZZLE_COLUMNS = 6;

/**
 * A fixed jumble rather than a fresh shuffle, so the dashboard doesn't rearrange on every visit.
 * Listed in placement order: with dense packing the small counts drop into the gaps beside the
 * big panels. The optional extras fill three rows of six exactly, and the default boxes five more.
 */
const PUZZLE_PIECES: { id: DashboardWidgetId; columns: number; rows: number }[] = [
  // The optional extras lead: three full rows when shown, and the rest packs below as if they weren't.
  { id: "featuredModel", columns: 3, rows: 2 },
  { id: "clock", columns: 3, rows: 1 },
  { id: "weather", columns: 3, rows: 1 },
  { id: "activityHeatmap", columns: 6, rows: 1 },
  { id: "topViewed", columns: 3, rows: 2 },
  { id: "collectionCount", columns: 2, rows: 1 },
  { id: "modelCount", columns: 1, rows: 1 },
  { id: "recentlyAdded", columns: 3, rows: 2 },
  { id: "authorCount", columns: 1, rows: 1 },
  { id: "categoryCount", columns: 2, rows: 1 },
  { id: "topPrinted", columns: 2, rows: 2 },
  { id: "topAuthors", columns: 2, rows: 2 },
  { id: "topProviders", columns: 2, rows: 2 },
];

export type PuzzlePiece<T> = { item: T; columns: number; rows: number };

/** Orders the given widgets into puzzle pieces. A widget the puzzle doesn't know yet goes last. */
export function puzzlePieces<T extends { id: DashboardWidgetId }>(widgets: T[]): PuzzlePiece<T>[] {
  const rank = (id: DashboardWidgetId) => {
    const index = PUZZLE_PIECES.findIndex((piece) => piece.id === id);
    return index === -1 ? PUZZLE_PIECES.length : index;
  };
  return widgets
    .toSorted((a, b) => rank(a.id) - rank(b.id))
    .map((item) => {
      const piece = PUZZLE_PIECES.find((p) => p.id === item.id);
      return { item, columns: piece?.columns ?? 2, rows: piece?.rows ?? 1 };
    });
}

/** Every piece, for drawing the puzzle's own tile in the layout picker. */
export const PUZZLE_SKETCH = PUZZLE_PIECES;
