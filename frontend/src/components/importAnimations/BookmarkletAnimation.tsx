import { keyframes } from "@emotion/react";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import { prefersReducedMotion } from "../storageAnimations/parts";

// A browser window on a model page: the bookmarklet is dragged up into the bookmarks bar, clicked, and Thingport's
// import dialog comes up with the page's link typing itself in. It fades out and starts again. Without motion it
// shows the end: the bookmark in the bar and the dialog open.
const CYCLE_S = 6;

const fadeOut = "92%, 100% { opacity: 0; }";
const ring = keyframes`
  0%, 38% { opacity: 0; transform: scale(0.6); }
  40% { opacity: 0.7; transform: scale(0.6); }
  52%, 100% { opacity: 0; transform: scale(1.7); }
`;
const dialog = keyframes`
  0%, 50% { opacity: 0; transform: scale(0.9); }
  58%, 88% { opacity: 1; transform: none; }
  ${fadeOut}
`;
const typing = keyframes`
  0%, 58% { transform: scaleX(0); }
  70%, 100% { transform: scaleX(1); }
`;

/** Dragged from (dx, dy) px away into its place in the bar. */
function drag(dx: number, dy: number) {
  return keyframes`
    0% { opacity: 0; transform: translate(${dx}px, ${dy}px); }
    6% { opacity: 1; transform: translate(${dx}px, ${dy}px) scale(1.06); }
    32% { opacity: 1; transform: scale(1.06); }
    36%, 88% { opacity: 1; transform: none; }
    ${fadeOut}
  `;
}

export default function BookmarkletAnimation({ width }: { width: number }) {
  const still = prefersReducedMotion();
  const run = (frames: ReturnType<typeof keyframes>, timing = `${CYCLE_S}s ease-in-out infinite`) =>
    still ? "none" : `${frames} ${timing}`;
  const height = Math.round(width * 0.62);
  const titleBar = height * 0.14;
  const bar = height * 0.12;
  const line = Math.max(2, width / 70);
  const dot = Math.max(3, width / 50);
  const radius = Math.max(4, width / 30);
  const pill = { left: width * 0.4, top: titleBar + bar * 0.2, width: width * 0.2, height: bar * 0.6 };
  const from = { dx: width * 0.02, dy: height * 0.62 };
  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        width,
        height,
        flexShrink: 0,
        borderRadius: `${radius}px`,
        overflow: "hidden",
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
      }}
    >
      {/* Title bar and its three dots. */}
      <Box sx={{ height: titleBar, bgcolor: "action.hover", position: "relative" }}>
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            sx={{
              position: "absolute",
              left: width * 0.04 + index * dot * 1.6,
              top: titleBar / 2 - dot / 2,
              width: dot,
              height: dot,
              borderRadius: "50%",
              bgcolor: "text.disabled",
            }}
          />
        ))}
      </Box>
      {/* The bookmarks bar, with two bookmarks already there. */}
      <Box sx={{ height: bar, borderBottom: 1, borderColor: "divider", position: "relative" }}>
        {[0, 1].map((index) => (
          <Box
            key={index}
            sx={{
              position: "absolute",
              left: width * (0.04 + index * 0.18),
              top: bar / 2 - line / 2,
              width: width * 0.13,
              height: line,
              borderRadius: 1,
              bgcolor: "divider",
            }}
          />
        ))}
      </Box>
      {/* The model page on the provider's site. */}
      <Box
        sx={{
          position: "absolute",
          left: width * 0.06,
          top: titleBar + bar + height * 0.1,
          width: width * 0.36,
          height: height * 0.46,
          borderRadius: `${radius / 1.5}px`,
          bgcolor: "action.selected",
        }}
      />
      {[0, 1, 2, 3].map((row) => (
        <Box
          key={row}
          sx={{
            position: "absolute",
            left: width * 0.48,
            top: titleBar + bar + height * (0.12 + row * 0.1),
            width: width * (row === 3 ? 0.24 : 0.42),
            height: line,
            borderRadius: 1,
            bgcolor: "divider",
          }}
        />
      ))}
      {/* Thingport's import dialog, the link filled in. */}
      <Box
        sx={{
          position: "absolute",
          left: width * 0.2,
          right: width * 0.2,
          top: titleBar + bar + height * 0.12,
          height: height * 0.5,
          borderRadius: `${radius}px`,
          bgcolor: "background.paper",
          boxShadow: (theme) => theme.shadows[8],
          border: 1,
          borderColor: "divider",
          animation: run(dialog),
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: "10%",
            top: "16%",
            width: "40%",
            height: line * 1.4,
            borderRadius: 1,
            bgcolor: "text.secondary",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: "10%",
            right: "10%",
            top: "36%",
            height: "26%",
            borderRadius: `${radius / 2}px`,
            border: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: "6%",
              right: "18%",
              top: "50%",
              height: line,
              marginTop: `${-line / 2}px`,
              borderRadius: 1,
              bgcolor: "primary.main",
              transformOrigin: "left",
              animation: run(typing, `${CYCLE_S}s steps(12, end) infinite`),
            }}
          />
        </Box>
        <Box
          sx={{
            position: "absolute",
            right: "10%",
            bottom: "12%",
            width: "26%",
            height: "18%",
            borderRadius: `${radius / 2}px`,
            bgcolor: "primary.main",
          }}
        />
      </Box>
      {/* The bookmarklet: dragged up into the bar, then clicked. */}
      <Box
        sx={{
          position: "absolute",
          ...pill,
          borderRadius: 99,
          bgcolor: "primary.main",
          boxShadow: (theme) => `0 2px 6px ${alpha(theme.palette.primary.main, 0.35)}`,
          animation: run(drag(from.dx, from.dy)),
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: -line * 1.5,
            borderRadius: 99,
            border: 2,
            borderColor: "primary.main",
            opacity: still ? 0 : undefined,
            animation: run(ring, `${CYCLE_S}s ease-out infinite`),
          }}
        />
        {/* The pointer holding it. */}
        <Box
          component="svg"
          viewBox="0 0 12 16"
          sx={{ position: "absolute", left: "60%", top: "40%", width: width * 0.045, overflow: "visible" }}
        >
          <Box
            component="path"
            d="M1 1 L1 13 L4 10 L6.5 15 L8.5 14 L6 9 L10.5 9 Z"
            sx={{ fill: (theme) => theme.palette.text.primary, stroke: (theme) => theme.palette.background.paper }}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </Box>
      </Box>
    </Box>
  );
}
