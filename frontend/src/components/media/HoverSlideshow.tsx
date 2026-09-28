import { useEffect, useState } from "react";
import Box from "@mui/material/Box";

// Sooner first change, but not so soon that a passing pointer flashes it.
const FIRST_SLIDE_DELAY_MS = 500;
const SLIDE_INTERVAL_MS = 1400;
const FADE_MS = 350;

type Props = {
  images: string[];
  alt?: string;
};

/** Mount only while it should run: images load on mount, and unmounting reveals the default
 *  instantly. The parent must be `position: relative`. */
export default function HoverSlideshow({ images, alt }: Props) {
  // null until the first tick, so the default thumbnail shows until the first fade-in.
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (images.length === 0) return;
    let timer = window.setTimeout(function tick() {
      setActive(current => (current === null ? 0 : (current + 1) % images.length));
      timer = window.setTimeout(tick, SLIDE_INTERVAL_MS);
    }, FIRST_SLIDE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [images.length]);

  return (
    <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {images.map((src, idx) => (
        <Box
          key={src}
          component="img"
          src={src}
          alt={idx === active ? alt ?? "" : ""}
          aria-hidden={idx !== active}
          // The outgoing slide stays opaque until the fade finishes, so the default never shows through.
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: idx === active ? 1 : 0,
            opacity: idx === active ? 1 : 0,
            transition: idx === active ? `opacity ${FADE_MS}ms ease` : `opacity 0ms linear ${FADE_MS}ms`,
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        />
      ))}
    </Box>
  );
}
