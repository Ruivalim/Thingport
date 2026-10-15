import { describe, expect, it } from "vitest";
import { MOSAICS } from "./TagTile";

describe("tag tile mosaics", () => {
  it("split the 4 x 4 grid into exactly n rectangles for n pictures", () => {
    MOSAICS.forEach((rows, index) => {
      const pictures = index + 1;
      expect(rows).toHaveLength(4);
      const letters = [...new Set(rows.join(""))].toSorted();
      // a, b, c... one letter per picture, in order.
      expect(letters).toEqual(Array.from({ length: pictures }, (_, i) => String.fromCharCode(97 + i)));
      for (const letter of letters) {
        const cells = rows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === letter ? [[x, y]] : [])));
        const xs = cells.map(([x]) => x);
        const ys = cells.map(([, y]) => y);
        const width = Math.max(...xs) - Math.min(...xs) + 1;
        const height = Math.max(...ys) - Math.min(...ys) + 1;
        // A CSS grid area must be one rectangle: every cell of its bounding box is that letter.
        expect(cells).toHaveLength(width * height);
      }
    });
  });
});
