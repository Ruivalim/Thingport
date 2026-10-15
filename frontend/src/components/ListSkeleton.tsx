import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";

// Text lines narrow and widen from row to row, so a placeholder list reads as names, not a block.
const lineWidth = (index: number, base = 70) => `${base - (index % 3) * 12}%`;

type RowProps = {
  count: number;
  /** What leads each row: a round avatar, a rounded thumbnail, or nothing. */
  lead?: "circle" | "rounded" | null;
  leadSize?: number;
  /** A second, shorter line under the first. */
  twoLines?: boolean;
  /** A short value at the end, e.g. a count or a date. */
  trailing?: boolean;
};

/** Rows of a list while it loads: an avatar or thumbnail, a line or two, maybe a value at the end. */
export function ListRowSkeletons({ count, lead = "rounded", leadSize = 40, twoLines, trailing }: RowProps) {
  return (
    <Stack spacing={1.25} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Stack key={index} direction="row" alignItems="center" spacing={1.5} sx={{ px: 1 }}>
          {lead && (
            <Skeleton
              variant={lead === "circle" ? "circular" : "rounded"}
              width={leadSize}
              height={leadSize}
              sx={{ flexShrink: 0 }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" sx={{ width: lineWidth(index) }} />
            {twoLines && <Skeleton variant="text" sx={{ fontSize: "0.75rem", width: lineWidth(index + 1, 45) }} />}
          </Box>
          {trailing && <Skeleton variant="text" sx={{ width: 56, flexShrink: 0 }} />}
        </Stack>
      ))}
    </Stack>
  );
}

/** Placeholder table rows under a table's real header, so the columns don't jump when data lands. */
export function TableRowSkeletons({ rows, columns }: { rows: number; columns: number }) {
  return Array.from({ length: rows }, (_, row) => (
    <TableRow key={row} aria-hidden>
      {Array.from({ length: columns }, (_cell, column) => (
        <TableCell key={column}>
          <Skeleton variant="text" sx={{ width: lineWidth(row + column, 80) }} />
        </TableCell>
      ))}
    </TableRow>
  ));
}
