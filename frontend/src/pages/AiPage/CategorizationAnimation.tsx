import { useEffect, useState } from "react";
import Box from "@mui/material/Box";

// A conveyor of rows, one color each. Every row holds a square that belongs in the row below, which keeps a gap
// for it. Each step that square drops into its gap, then the rows move up one: the top row leaves and a new one
// comes in at the bottom. The colors cycle, so after a step the picture is the start again, one color on.
const COLORS = ["#ef4444", "#22c55e", "#a855f7", "#eab308"];
const COLUMNS = 5;
const VISIBLE = 3;

// One step: still, then the drop, then the rows moving up.
const HOLD_MS = 700;
const DROP_MS = 550;
const SCROLL_MS = 450;

type Phase = "hold" | "drop" | "scroll";

function move(ms: number): string {
  return `transform ${ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
}

function mix(value: number): number {
  let hash = Math.imul(value + 1, 0x9e3779b1);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

const misfitColumn = (conveyorRow: number) => (mix(conveyorRow) >>> 3) % COLUMNS;

/**
 * Where a row keeps its misfit and its gap, scattered but fixed per row: keyed by the row's place in the endless
 * conveyor, not on screen, so a row keeps its layout as it moves up and the loop stays seamless. A misfit in the
 * same column as the row above's moves over, so the drops don't look repeated.
 */
function layoutOf(conveyorRow: number): { misfit: number; gap: number } {
  const picked = misfitColumn(conveyorRow);
  const misfit = picked === misfitColumn(conveyorRow - 1) ? (picked + 2) % COLUMNS : picked;
  return { misfit, gap: (misfit + 1 + ((mix(conveyorRow) >>> 11) % (COLUMNS - 1))) % COLUMNS };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Squares sorted into rows by color, looping; still while the feature is off or motion is reduced. */
export default function CategorizationAnimation({ size, paused }: { size: number; paused?: boolean }) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("hold");
  const still = paused || prefersReducedMotion();

  useEffect(() => {
    if (still) {
      setPhase("hold");
      return;
    }
    const next: Record<Phase, [Phase, number]> = {
      hold: ["drop", HOLD_MS],
      drop: ["scroll", DROP_MS],
      scroll: ["hold", SCROLL_MS],
    };
    const [to, after] = next[phase];
    const timer = window.setTimeout(() => {
      if (to === "hold") setStep((current) => current + 1);
      setPhase(to);
    }, after);
    return () => window.clearTimeout(timer);
  }, [phase, still]);

  const rowHeight = size / VISIBLE;
  const block = Math.round(size * 0.15);
  const gap = (size - 8 - COLUMNS * block) / (COLUMNS - 1);
  const x = (column: number) => 4 + column * (block + gap);
  const y = (row: number) => row * rowHeight + (rowHeight - block) / 2;
  const color = (row: number) => COLORS[(step + row) % COLORS.length];
  const layout = (row: number) => layoutOf(step + row);

  // The top row's misfit drops into the gap of the row below, wherever that is.
  const dropping = phase === "drop" || phase === "scroll";
  const drop = `translate(${x(layout(1).gap) - x(layout(0).misfit)}px, ${rowHeight}px)`;
  return (
    <Box sx={{ position: "relative", width: size, height: size, overflow: "hidden" }} aria-hidden>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          transform: phase === "scroll" ? `translateY(${-rowHeight}px)` : "none",
          transition: phase === "scroll" ? move(SCROLL_MS - 50) : "none",
        }}
      >
        {/* One row more than shows, ready to come in at the bottom. */}
        {Array.from({ length: VISIBLE + 1 }, (_row, row) => (
          <Box key={`${step}-${row}`}>
            <Box
              sx={{
                position: "absolute",
                left: 1,
                right: 1,
                top: row * rowHeight + 2,
                height: rowHeight - 4,
                borderRadius: "7px",
                bgcolor: `${color(row)}26`,
              }}
            />
            {Array.from({ length: COLUMNS }, (_column, column) => {
              // The top row's gap was filled by the step before; the others are still waiting.
              if (column === layout(row).gap && row > 0) return null;
              const misfit = column === layout(row).misfit;
              return (
                <Box
                  key={column}
                  sx={{
                    position: "absolute",
                    left: x(column),
                    top: y(row),
                    width: block,
                    height: block,
                    borderRadius: "3px",
                    bgcolor: misfit ? color(row + 1) : color(row),
                    boxShadow: misfit ? "0 1px 3px rgba(0, 0, 0, 0.25)" : "none",
                    zIndex: misfit ? 1 : 0,
                    transform: misfit && row === 0 && dropping ? drop : "none",
                    transition: misfit && row === 0 && phase === "drop" ? move(DROP_MS - 50) : "none",
                  }}
                />
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
