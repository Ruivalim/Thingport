import Box from "@mui/material/Box";
import type { Theme } from "@mui/material/styles";

const trackBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)");
const chosenBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.16)" : "#ffffff");

type Props<T extends string> = {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
};

/** One track, the chosen option raised on a lighter pill. */
export default function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <Box
      aria-label={label}
      sx={{
        display: "inline-flex",
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
        return (
          <Box
            key={option.value}
            component="button"
            type="button"
            aria-pressed={chosen}
            onClick={() => onChange(option.value)}
            sx={{
              border: 0,
              cursor: "pointer",
              px: 1.75,
              py: 0.625,
              borderRadius: "7px",
              font: "inherit",
              fontSize: "0.8rem",
              color: chosen ? "text.primary" : "text.secondary",
              bgcolor: chosen ? chosenBg : "transparent",
              boxShadow: chosen ? "0 1px 3px rgba(0, 0, 0, 0.2)" : "none",
              transition: "background-color 150ms, color 150ms",
              "&:hover": { color: "text.primary" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
            }}
          >
            {option.label}
          </Box>
        );
      })}
    </Box>
  );
}
