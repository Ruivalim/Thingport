import { useMemo } from "react";
import { keyframes } from "@emotion/react";
import Box from "@mui/material/Box";

// Models dropping into one portal and out of another onto the shelf: Thingporting a link into the library.
// Pure CSS; sized from `size`, so the same picture works on the progress bar and larger.
const MODELS = 3;
const CYCLE_S = 2.7;
const COLORS = ["#22c55e", "#3b82f6", "#f59e0b"];
const PORTAL_IN = "#38bdf8";
const PORTAL_OUT = "#a78bfa";
const SHELF = "#94a3b8";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export default function ImportPortalAnimation({ size, paused }: { size: number; paused?: boolean }) {
  const still = paused || prefersReducedMotion();
  const portalW = size * 0.62;
  const portalH = size * 0.16;
  const portalX = (size - portalW) / 2;
  const inY = size * 0.24;
  const outY = size * 0.5;
  const shelfY = size * 0.88;
  const model = size * 0.2;
  const modelX = (size - model) / 2;

  const { teleport, pulse } = useMemo(() => {
    const at = (y: number) => `translate(${modelX}px, ${y - model / 2}px)`;
    return {
      // Down into the top portal, gone for a beat, out of the bottom one, a bounce on the shelf.
      teleport: keyframes`
        0% { transform: ${at(size * 0.02)} scale(1); opacity: 0; }
        8% { opacity: 1; }
        30% { transform: ${at(inY)} scale(0.15, 0.1); opacity: 1; }
        31%, 44% { transform: ${at(inY)} scale(0.15, 0.1); opacity: 0; }
        45% { transform: ${at(outY)} scale(0.15, 0.1); opacity: 1; }
        66% { transform: ${at(shelfY - model / 2)} scale(1); }
        72% { transform: ${at(shelfY - model / 2 + model * 0.06)} scale(1.12, 0.88); }
        78% { transform: ${at(shelfY - model / 2)} scale(1); opacity: 1; }
        100% { transform: ${at(shelfY - model / 2)} scale(1); opacity: 0; }
      `,
      pulse: keyframes`
        0%, 100% { transform: scale(1); opacity: 0.85; }
        50% { transform: scale(1.12); opacity: 1; }
      `,
    };
  }, [modelX, model, inY, outY, shelfY, size]);

  const portal = (top: number, color: string, delayS: number) => (
    <Box
      sx={{
        position: "absolute",
        left: portalX,
        top: top - portalH / 2,
        width: portalW,
        height: portalH,
        borderRadius: "50%",
        border: `${Math.max(1.5, size / 22)}px solid ${color}`,
        background: `radial-gradient(ellipse at center, ${color}55 0%, ${color}11 60%, transparent 75%)`,
        boxShadow: `0 0 ${size / 8}px ${color}66`,
        animation: still ? "none" : `${pulse} ${CYCLE_S / MODELS}s ease-in-out ${delayS}s infinite`,
      }}
    />
  );
  const radius = Math.max(2, size / 18);

  return (
    <Box aria-hidden sx={{ position: "relative", width: size, height: size, overflow: "hidden" }}>
      {portal(inY, PORTAL_IN, 0)}
      {portal(outY, PORTAL_OUT, (CYCLE_S / MODELS) * 0.5)}
      <Box
        sx={{
          position: "absolute",
          left: size * 0.14,
          top: shelfY,
          width: size * 0.72,
          height: Math.max(1.5, size / 26),
          borderRadius: 1,
          bgcolor: SHELF,
        }}
      />
      {Array.from({ length: MODELS }, (_model, index) => (
        <Box
          key={index}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            width: model,
            height: model,
            borderRadius: `${radius}px`,
            bgcolor: COLORS[index],
            // A lit top face, so it reads as a little printed block rather than a square.
            backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45))",
            backgroundSize: `100% ${model * 0.3}px`,
            backgroundRepeat: "no-repeat",
            boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.18)",
            transform: still ? `translate(${modelX}px, ${shelfY - model}px)` : undefined,
            opacity: still && index > 0 ? 0 : undefined,
            animation: still
              ? "none"
              : `${teleport} ${CYCLE_S}s ease-in-out ${(index * CYCLE_S) / MODELS}s infinite both`,
          }}
        />
      ))}
    </Box>
  );
}
