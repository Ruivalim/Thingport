import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

/** A small "?" after a label, explaining it in a tooltip. Focusable, so the explanation is there
 *  for keyboards and screen readers too. */
export default function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip title={text}>
      <Box
        component="span"
        tabIndex={0}
        role="note"
        aria-label={text}
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
