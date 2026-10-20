import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import type { Theme } from "@mui/material/styles";

const trackBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)");
const chosenBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.16)" : "#ffffff");

type Props<T extends string> = {
  value: T;
  /** With an `icon`, the option shows only it; its label is then the tooltip and the accessible name. */
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
};

/** One track, the chosen option raised on a lighter pill. */
export default function Segmented<T extends string>({ value, options, onChange, label, disabled }: Props<T>) {
  return (
    <Box
      aria-label={label}
      sx={{
        display: "inline-flex",
        // Many options wrap on a narrow screen instead of running off it.
        flexWrap: "wrap",
        maxWidth: "100%",
        gap: "2px",
        p: "3px",
        borderRadius: "10px",
        bgcolor: trackBg,
        border: 1,
        borderColor: "divider",
      }}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        const iconOnly = option.icon !== undefined;
        const button = (
          <Box
            key={option.value}
            component="button"
            type="button"
            aria-pressed={chosen}
            aria-label={iconOnly ? option.label : undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            sx={{
              border: 0,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled && !chosen ? 0.6 : 1,
              px: iconOnly ? 1 : 1.75,
              py: iconOnly ? 0.75 : 0.625,
              display: iconOnly ? "inline-flex" : undefined,
              alignItems: "center",
              borderRadius: "7px",
              font: "inherit",
              fontSize: "0.8rem",
              color: chosen ? "text.primary" : "text.secondary",
              bgcolor: chosen ? chosenBg : "transparent",
              boxShadow: chosen ? "0 1px 3px rgba(0, 0, 0, 0.2)" : "none",
              transition: "background-color 150ms, color 150ms",
              // Unchosen logos sit back in grey, in colour again on hover.
              "& > svg": {
                opacity: chosen ? 1 : 0.55,
                filter: chosen ? "none" : "grayscale(1)",
                transition: "opacity 150ms, filter 150ms",
              },
              "&:hover": { color: "text.primary" },
              "&:hover > svg": { opacity: 1, filter: "none" },
              "@media (prefers-reduced-motion: reduce)": { transition: "none", "& > svg": { transition: "none" } },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
            }}
          >
            {option.icon ?? option.label}
          </Box>
        );
        return iconOnly ? (
          <Tooltip key={option.value} title={option.label}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </Box>
  );
}
