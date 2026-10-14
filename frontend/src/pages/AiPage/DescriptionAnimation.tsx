import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { mix } from "./pseudoRandom";

// Lines of text drawn as skeleton bars. Each step a line or two turn red and fold away, the rest move up into the
// space, and as many new lines grow in at the bottom; then other lines, picked at random, go the same way.
const LINES = 6;
// As parts of the size, so the same picture works in the feature tile and in the small one on the progress bar.
const LINE_HEIGHT = 1 / 12;
const LINE_GAP = 1 / 17;

const HOLD_MS = 900;
const MARK_MS = 500;
const REMOVE_MS = 450;
const ADD_MS = 450;

type LineState = "shown" | "marked" | "removed" | "added";
type Line = { id: number; state: LineState };
type Phase = "hold" | "mark" | "remove" | "add";

/** A line's length, fixed per line, between half and nearly the full width. */
const widthOf = (id: number) => 48 + (mix(id) % 46);

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

const firstLines = (): Line[] => Array.from({ length: LINES }, (_line, id) => ({ id, state: "shown" }));

/** Text cleaned up line by line, looping; still while the feature is off or motion is reduced. */
export default function DescriptionAnimation({ size, paused }: { size: number; paused?: boolean }) {
  const [lines, setLines] = useState<Line[]>(firstLines);
  const [phase, setPhase] = useState<Phase>("hold");
  const [step, setStep] = useState(0);
  const still = paused || prefersReducedMotion();

  useEffect(() => {
    if (still) return;
    const timers: Record<Phase, [number, () => void]> = {
      hold: [
        HOLD_MS,
        () => {
          // One or two lines, never the same ones twice running: the picks come from the step.
          const count = 1 + (mix(step) % 2);
          const picked = new Set<number>();
          for (let n = 0; picked.size < count && n < 8; n++) picked.add(mix(step * 7 + n) % LINES);
          setLines((current) =>
            current.map((line, index) => (picked.has(index) ? { ...line, state: "marked" } : line)),
          );
          setPhase("mark");
        },
      ],
      mark: [
        MARK_MS,
        () => {
          setLines((current) =>
            current.map((line) => (line.state === "marked" ? { ...line, state: "removed" } : line)),
          );
          setPhase("remove");
        },
      ],
      remove: [
        REMOVE_MS,
        () => {
          setLines((current) => {
            const kept = current.filter((line) => line.state !== "removed");
            const next = Math.max(...current.map((line) => line.id)) + 1;
            const added = Array.from({ length: LINES - kept.length }, (_line, n): Line => ({
              id: next + n,
              state: "added",
            }));
            return [...kept, ...added];
          });
          setPhase("add");
        },
      ],
      add: [
        // A moment for the added lines to mount folded, so growing them in animates.
        30,
        () => {
          setLines((current) => current.map((line) => (line.state === "added" ? { ...line, state: "shown" } : line)));
          setStep((current) => current + 1);
          setPhase("hold");
        },
      ],
    };
    const [after, next] = timers[phase];
    const timer = window.setTimeout(next, after);
    return () => window.clearTimeout(timer);
  }, [phase, step, still]);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        px: `${size / 10}px`,
      }}
      aria-hidden
    >
      {lines.map((line) => {
        const folded = line.state === "removed" || line.state === "added";
        return (
          <Box
            key={line.id}
            sx={{
              flexShrink: 0,
              width: `${widthOf(line.id)}%`,
              height: folded ? 0 : size * LINE_HEIGHT,
              mb: folded ? 0 : `${size * LINE_GAP}px`,
              borderRadius: `${Math.max(2, size / 21)}px`,
              opacity: folded ? 0 : 1,
              bgcolor: line.state === "marked" || line.state === "removed" ? "#ef4444" : "#e2e8f0",
              transition: `height ${ADD_MS - 50}ms ease, margin ${ADD_MS - 50}ms ease, opacity ${REMOVE_MS - 50}ms ease, background-color 250ms ease`,
            }}
          />
        );
      })}
    </Box>
  );
}
