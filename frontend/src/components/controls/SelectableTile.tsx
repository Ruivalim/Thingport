import type React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";

type Props = {
  selected: boolean;
  onClick: () => void;
  label: string;
  /** For an on/off tile: switched off, its picture fades and greys, so the user sees what they'd lose. */
  dimWhenOff?: boolean;
  /** The picture above the label. */
  children: React.ReactNode;
};

/** A pressable card with a small drawing and a label, ticked while selected. */
export default function SelectableTile({ selected, onClick, label, dimWhenOff = false, children }: Props) {
  const dimmed = dimWhenOff && !selected;
  return (
    <ButtonBase
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 1,
        p: 1.25,
        borderRadius: "10px",
        border: 2,
        borderColor: selected ? "primary.main" : "divider",
        borderStyle: dimmed ? "dashed" : "solid",
        transition: "border-color 150ms",
        "&:hover": { borderColor: selected ? "primary.main" : "text.disabled" },
        "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          opacity: dimmed ? 0.4 : 1,
          filter: dimmed ? "grayscale(1)" : "none",
          transform: dimmed ? "scale(0.94)" : "none",
          transition: "opacity 200ms ease, filter 200ms ease, transform 200ms ease",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        {children}
      </Box>
      <Typography
        variant="caption"
        sx={{ textAlign: "center", lineHeight: 1.3, color: dimmed ? "text.secondary" : "text.primary" }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          position: "absolute",
          top: -9,
          right: -9,
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "success.main",
          color: "success.contrastText",
          boxShadow: 1,
          opacity: selected ? 1 : 0,
          transform: selected ? "scale(1)" : "scale(0.4)",
          transition: "opacity 150ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <CheckIcon sx={{ fontSize: 15 }} />
      </Box>
    </ButtonBase>
  );
}
