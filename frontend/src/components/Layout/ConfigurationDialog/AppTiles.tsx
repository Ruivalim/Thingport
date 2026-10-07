import React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";

const TILE = 44;
const BADGE = 16;

const hoverBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)");

export function AppGrid({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 76px)", gap: 1 }}>{children}</Box>;
}

type TileProps = {
  name: string;
  logo: React.ReactNode;
  /** Coloured when on, grey when off. */
  on: boolean;
  /** A tick or a cross in the corner; none when undefined. */
  badge?: boolean;
  /** Shown as if hovered, while its menu or box is open. */
  highlighted?: boolean;
  tooltip?: string;
  ariaLabel: string;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  /** Double-click or Enter. */
  onActivate: () => void;
};

/** An app icon with its name under it. */
export function AppTile({
  name,
  logo,
  on,
  badge,
  highlighted,
  tooltip,
  ariaLabel,
  onContextMenu,
  onActivate,
}: TileProps) {
  return (
    <Tooltip title={tooltip ?? ""} placement="bottom">
      <ButtonBase
        onContextMenu={onContextMenu}
        onDoubleClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter") onActivate();
        }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        sx={{
          flexDirection: "column",
          justifyContent: "flex-start",
          gap: 0.75,
          px: 0.5,
          py: 1,
          borderRadius: "10px",
          bgcolor: highlighted ? hoverBg : "transparent",
          "&:hover": { bgcolor: hoverBg },
          "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main", outlineOffset: -2 },
        }}
      >
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              width: TILE,
              height: TILE,
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "#ffffff",
              boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
              filter: on ? "none" : "grayscale(1)",
              opacity: on ? 1 : 0.45,
              transition: "filter 200ms, opacity 200ms",
            }}
          >
            {logo}
          </Box>
          {badge !== undefined && <StatusBadge ok={badge} />}
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.7rem",
            lineHeight: 1.25,
            maxWidth: "100%",
            textAlign: "center",
            // Long names take two lines, then are cut short.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            color: on ? "text.primary" : "text.secondary",
          }}
        >
          {name}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

/** A circle with a tick or a cross. SVG, so dark mode's square-corners rule leaves it round. */
function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 16 16"
      aria-hidden="true"
      sx={{
        position: "absolute",
        top: -BADGE / 3,
        right: -BADGE / 3,
        width: BADGE,
        height: BADGE,
        color: "background.paper",
      }}
    >
      <circle
        cx="8"
        cy="8"
        r="7.25"
        fill={ok ? "#16a34a" : "#dc2626"}
        // A ring in the panel's colour sets it off the tile.
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {ok ? (
        <path
          d="M4.75 8.25 7 10.5l4.25-4.75"
          fill="none"
          stroke="#fff"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path d="M5.5 5.5l5 5m0-5-5 5" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" />
      )}
    </Box>
  );
}

/** Where a tile's context menu opens: at the pointer, or under the tile when opened from the keyboard. */
export function menuPosition(event: React.MouseEvent<HTMLElement>): { top: number; left: number } {
  event.preventDefault();
  const rect = event.currentTarget.getBoundingClientRect();
  const fromKeyboard = event.clientX === 0 && event.clientY === 0;
  return { top: fromKeyboard ? rect.bottom : event.clientY, left: fromKeyboard ? rect.left : event.clientX };
}

/** The top of a tile's context menu: which app it's for, and its state. */
export function TileMenuHeader({ logo, name, status }: { logo: React.ReactNode; name: string; status: string }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{ px: 2, pt: 0.75, pb: 1.25, mb: 0.5, borderBottom: 1, borderColor: "divider" }}
    >
      {logo}
      <Box>
        <Typography variant="body2" fontWeight={600} sx={{ color: (muiTheme) => muiTheme.thingport.headingText }}>
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {status}
        </Typography>
      </Box>
    </Stack>
  );
}
