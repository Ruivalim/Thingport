import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

type Props = {
  /** What it says, and what screen readers read. */
  text: string;
  /** Shown instead of `text` when the explanation needs more than a line, e.g. a title and a list. */
  content?: ReactNode;
};

/** A small "?" after a label, explaining it in a tooltip. Focusable, so the explanation is there
 *  for keyboards and screen readers too. */
export default function HelpTip({ text, content }: Props) {
  return (
    <Tooltip
      title={content ?? text}
      slotProps={content ? { tooltip: { sx: { maxWidth: 420, p: 1.5, fontSize: "0.8125rem" } } } : undefined}
    >
      <Box
        component="span"
        tabIndex={0}
        role="note"
        aria-label={text}
        // Inside a checkbox or switch label, a click here is for reading, not for toggling it.
        onClick={(event) => event.preventDefault()}
        sx={{
          display: "inline-flex",
          ml: 0.5,
          verticalAlign: "-3px",
          color: "text.secondary",
          cursor: "help",
          borderRadius: "50%",
          // Under an uppercase label, the tooltip's own text stays as written.
          textTransform: "none",
          "&:hover, &:focus-visible": { color: "text.primary" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: 15 }} />
      </Box>
    </Tooltip>
  );
}
