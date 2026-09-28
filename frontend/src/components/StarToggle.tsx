import { useEffect, useRef, useState } from "react";
import { keyframes } from "@emotion/react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import StarIcon from "@mui/icons-material/Star";
import type { SxProps, Theme } from "@mui/material/styles";

// Burst animation adapted from https://codepen.io/matthewbolanos/pen/yYXQZp. Sizes are in em and
// viewBox units so they scale with the icon.
const popping = keyframes`
  0%   { transform: scale(0, 0); }
  40%  { transform: scale(0, 0); }
  75%  { transform: scale(1.3, 1.3); }
  100% { transform: scale(1, 1); }
`;
const ringBorderWidth = keyframes`
  0%   { border-width: 0; }
  50%  { border-width: .25em; }
  100% { border-width: 0; }
`;
const ringSize = keyframes`
  0%   { width: 0; height: 0; }
  100% { width: 1.5em; height: 1.5em; }
`;
// The translate centering must be repeated in every frame or the animation's transform replaces it.
const sparkleSize = keyframes`
  0%  { transform: translate(-50%, -50%) scale(.2, .2); }
  5%  { transform: translate(-50%, -50%) scale(.2, .2); }
  85% { transform: translate(-50%, -50%) scale(2, 2); }
`;
const sparkleWidth = keyframes`
  0%   { stroke-width: 0; }
  15%  { stroke-width: 20; }
  100% { stroke-width: 0; }
`;

type Props = {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  activeColor?: string;
  inactiveColor?: string;
  /** Glyph size in px; also the em baseline for the animation, so it must be a real pixel size. */
  size?: number;
  sx?: SxProps<Theme>;
};

/** Plays the burst only on an actual false -> true click, never on mount or unfavourite. */
export default function StarToggle({
  active,
  onClick,
  disabled,
  ariaLabel,
  activeColor = "#f6a800",
  inactiveColor = "text.disabled",
  size = 20,
  sx,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      // Reset first so a quick unfavourite -> refavourite still restarts the animation.
      setPlaying(false);
      const raf = requestAnimationFrame(() => setPlaying(true));
      wasActive.current = active;
      return () => cancelAnimationFrame(raf);
    }
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    if (!playing) return;
    // A timeout, not onAnimationEnd: the animations end at different times and the first to bubble
    // would cut the others short.
    const PLAYING_DURATION_MS = 650;
    const timer = setTimeout(() => setPlaying(false), PLAYING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [playing]);

  return (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      sx={{
        position: "relative",
        fontSize: `${size}px`,
        color: active ? activeColor : inactiveColor,
        transition: active ? "color 0s" : "color .25s ease",
        "&::before": {
          content: '""',
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 0,
          height: 0,
          borderRadius: "10em",
          border: "0px solid",
          borderColor: activeColor,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          ...(playing && { animation: `${ringBorderWidth} .35s 1, ${ringSize} .35s 1` }),
        },
        ...sx,
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 100 100"
        aria-hidden
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "1.25em",
          height: "1.25em",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          ...(playing && { animation: `${sparkleSize} .65s 1` }),
        }}
      >
        <Box
          component="circle"
          cx={50}
          cy={50}
          r={24}
          fill="transparent"
          stroke={activeColor}
          strokeWidth={0}
          strokeDasharray="1 29"
          sx={playing ? { animation: `${sparkleWidth} .65s 1` } : undefined}
        />
      </Box>
      <StarIcon
        fontSize="inherit"
        sx={{ position: "relative", ...(playing && { animation: `${popping} .5s 1` }) }}
      />
    </IconButton>
  );
}
