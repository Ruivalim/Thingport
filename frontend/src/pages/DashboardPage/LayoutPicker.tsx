import { useTranslation } from "react-i18next";
import { alpha, type Theme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import type { DashboardLayout } from "../../api/settings";
import SelectableTile from "../../components/controls/SelectableTile";
import { DASHBOARD_LAYOUTS, PUZZLE_COLUMNS, PUZZLE_SKETCH, type LayoutDefinition } from "./layouts";
import { DASHBOARD_WIDGETS } from "./widgets";

const COUNT_IDS = new Set(DASHBOARD_WIDGETS.filter((widget) => widget.column === 0).map((widget) => widget.id));
const countColor = (theme: Theme) => alpha(theme.palette.primary.main, 0.55);

type Props = {
  value: DashboardLayout;
  onChange: (layout: DashboardLayout) => void;
};

/** A small drawing of the layout: the count boxes in the accent colour, the larger panels in grey. */
function LayoutSketch({ layout }: { layout: LayoutDefinition }) {
  if (layout.counts === "mixed")
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${PUZZLE_COLUMNS}, 1fr)`,
          gridAutoRows: "1fr",
          gridAutoFlow: "dense",
          gap: "4px",
          width: "100%",
          aspectRatio: "16 / 10",
        }}
      >
        {PUZZLE_SKETCH.map((piece) => (
          <Box
            key={piece.id}
            sx={{
              gridColumn: `span ${piece.columns}`,
              gridRow: `span ${piece.rows}`,
              borderRadius: "3px",
              bgcolor: COUNT_IDS.has(piece.id) ? countColor : "action.selected",
            }}
          />
        ))}
      </Box>
    );
  const counts = (
    <Box
      sx={{
        flex: layout.counts === "left" || layout.counts === "right" ? 0.7 : "0 0 22%",
        borderRadius: "3px",
        bgcolor: countColor,
      }}
    />
  );
  const panels = (
    <Box sx={{ flex: 1, display: "flex", gap: "4px" }}>
      {Array.from({ length: layout.columns }, (_, index) => (
        <Box key={index} sx={{ flex: 1, borderRadius: "3px", bgcolor: "action.selected" }} />
      ))}
    </Box>
  );
  const sideways = layout.counts === "left" || layout.counts === "right";
  const countsFirst = layout.counts === "left" || layout.counts === "top";
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: sideways ? "row" : "column",
        gap: "4px",
        width: "100%",
        aspectRatio: "16 / 10",
      }}
    >
      {countsFirst ? counts : panels}
      {countsFirst ? panels : counts}
    </Box>
  );
}

export default function LayoutPicker({ value, onChange }: Props) {
  const { t } = useTranslation("app");
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
      {DASHBOARD_LAYOUTS.map((layout) => (
        <SelectableTile
          key={layout.id}
          selected={layout.id === value}
          label={t(`dashboard.widgets.layouts.${layout.id}`)}
          onClick={() => onChange(layout.id)}
        >
          <LayoutSketch layout={layout} />
        </SelectableTile>
      ))}
    </Box>
  );
}
