import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/material/Box";
import type { TagSummary } from "../../api/tags";
import { TagTileSkeletons } from "./TagTile";

const MIN_TILE = 160;
const GAP = 12;

type Props = {
  tags: TagSummary[];
  /** Skeleton tiles after the last tag, while the next page loads. */
  skeletons: number;
  renderTile: (tag: TagSummary) => ReactNode;
};

/**
 * The tag tiles, only the rows near the screen in the page: hundreds of tags would otherwise keep thousands of
 * pictures in the page. Tiles are square, so each row's height follows from the width, without measuring.
 */
export default function VirtualTagGrid({ tags, skeletons, renderTile }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [top, setTop] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      setWidth(node.clientWidth);
      setTop(node.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // As many 160px columns as fit, at least two, like the plain grid's auto-fill.
  const columns = width ? Math.max(2, Math.floor((width + GAP) / (MIN_TILE + GAP))) : 2;
  const tile = width ? (width - GAP * (columns - 1)) / columns : MIN_TILE;
  const cells = tags.length + skeletons;
  const rows = Math.ceil(cells / columns);

  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => tile + GAP,
    overscan: 3,
    scrollMargin: top,
  });
  // A new width changes every row's height.
  useEffect(() => {
    virtualizer.measure();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [virtualizer, tile]);

  return (
    <Box ref={ref} sx={{ position: "relative", width: "100%", height: Math.max(0, virtualizer.getTotalSize() - GAP) }}>
      {virtualizer.getVirtualItems().map((row) => {
        const start = row.index * columns;
        const end = Math.min(start + columns, cells);
        const rowTags = tags.slice(start, Math.min(end, tags.length));
        return (
          <Box
            key={row.key}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: `${GAP}px`,
            }}
          >
            {rowTags.map(renderTile)}
            {end > tags.length && <TagTileSkeletons count={end - Math.max(start, tags.length)} />}
          </Box>
        );
      })}
    </Box>
  );
}
