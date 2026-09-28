import { useEffect, useRef, useState } from "react";
import { keyframes } from "@emotion/react";
import Box from "@mui/material/Box";

// The old value drops out below, then the new one drops in from above; overflow clips both.
const EXIT_MS = 200;
const ENTER_MS = 240;

const enterFromTop = keyframes`
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
`;
const exitToBottom = keyframes`
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
`;

type Props = {
  value: number;
};

/** Animates changes like an odometer; the first render is static. Inherits typography. */
export default function RollingNumber({ value }: Props) {
  const lastValueRef = useRef(value);
  // rollKey remounts both spans to restart their animations, even mid-animation.
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [rollKey, setRollKey] = useState(0);

  useEffect(() => {
    if (value === lastValueRef.current) return;
    setOutgoing(lastValueRef.current);
    setRollKey(k => k + 1);
    lastValueRef.current = value;
  }, [value]);

  return (
    <Box
      component="span"
      sx={{ position: "relative", display: "inline-flex", overflow: "hidden", verticalAlign: "bottom" }}
    >
      <Box
        component="span"
        key={`in-${rollKey}`}
        // Keyed off rollKey so clearing `outgoing` doesn't cut this animation short. "backwards" keeps it
        // hidden above the slot during the delay.
        sx={
          rollKey > 0
            ? {
                animation: `${enterFromTop} ${ENTER_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1) ${EXIT_MS}ms backwards`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }
            : undefined
        }
      >
        {value}
      </Box>
      {outgoing !== null && (
        <Box
          component="span"
          key={`out-${rollKey}`}
          aria-hidden
          onAnimationEnd={() => setOutgoing(null)}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            animation: `${exitToBottom} ${EXIT_MS}ms cubic-bezier(0.5, 0, 0.9, 0.4) forwards`,
            "@media (prefers-reduced-motion: reduce)": { display: "none" },
          }}
        >
          {outgoing}
        </Box>
      )}
    </Box>
  );
}
