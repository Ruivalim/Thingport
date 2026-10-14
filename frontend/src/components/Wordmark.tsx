import { useState } from "react";
import { keyframes } from "@emotion/react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import lockupColor from "../assets/logos/thingport-lockup-compact-color.svg";
import lockupOnDark from "../assets/logos/thingport-lockup-compact-on-dark.svg";
import autumn from "../assets/logos/seasonal/autumn.svg";
import birthday from "../assets/logos/seasonal/birthday.svg";
import christmas from "../assets/logos/seasonal/christmas.svg";
import coffee from "../assets/logos/seasonal/coffee.svg";
import diwali from "../assets/logos/seasonal/diwali.svg";
import easter from "../assets/logos/seasonal/easter.svg";
import halloween from "../assets/logos/seasonal/halloween.svg";
import hanukkah from "../assets/logos/seasonal/hanukkah.svg";
import holi from "../assets/logos/seasonal/holi.svg";
import jonines from "../assets/logos/seasonal/jonines.svg";
import lunarNewYear from "../assets/logos/seasonal/lunarnewyear.svg";
import muertos from "../assets/logos/seasonal/muertos.svg";
import newYear from "../assets/logos/seasonal/newyear.svg";
import programmersDay from "../assets/logos/seasonal/programmersday.svg";
import ramadan from "../assets/logos/seasonal/ramadan.svg";
import saltibarsciai from "../assets/logos/seasonal/saltibarsciai.svg";
import spring from "../assets/logos/seasonal/spring.svg";
import stPatricks from "../assets/logos/seasonal/stpatricks.svg";
import summer from "../assets/logos/seasonal/summer.svg";
import valentines from "../assets/logos/seasonal/valentines.svg";
import winter from "../assets/logos/seasonal/winter.svg";
import womensDay from "../assets/logos/seasonal/womensday.svg";
import { type Season, seasonFor } from "../utils/season";

type Props = {
  size?: "lg" | "md" | "sm";
  /** Dresses the logo up for the season it is, if any. */
  seasonal?: boolean;
};

const HEIGHTS: Record<NonNullable<Props["size"]>, string> = {
  lg: "2.25rem",
  md: "1.5rem",
  sm: "1.125rem",
};

// April Fools' turns the logo itself, so it has none.
const OVERLAYS: Record<Exclude<Season, "aprilFools">, string> = {
  newYear,
  lunarNewYear,
  valentines,
  holi,
  womensDay,
  stPatricks,
  spring,
  ramadan,
  easter,
  saltibarsciai,
  summer,
  jonines,
  birthday,
  programmersDay,
  autumn,
  coffee,
  diwali,
  halloween,
  muertos,
  hanukkah,
  winter,
  christmas,
};

// Upside down all day, with a wobble now and then as if it noticed.
const upsideDown = keyframes`
  0%, 70%, 100% { transform: rotate(180deg); }
  76% { transform: rotate(168deg); }
  82% { transform: rotate(191deg); }
  88% { transform: rotate(176deg); }
  94% { transform: rotate(183deg); }
`;

export default function Wordmark({ size = "md", seasonal = false }: Props) {
  const theme = useTheme();
  const [season] = useState(() => (seasonal ? seasonFor(new Date()) : null));
  const src = theme.palette.mode === "dark" ? lockupOnDark : lockupColor;
  const height = HEIGHTS[size];
  const overlay = season && season !== "aprilFools" ? OVERLAYS[season] : undefined;
  const logo = (
    <Box
      component="img"
      src={src}
      alt="Thingport"
      sx={{
        height,
        width: "auto",
        display: "block",
        ...(season === "aprilFools" && {
          transform: "rotate(180deg)",
          animation: `${upsideDown} 5s ease-in-out infinite`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }),
      }}
    />
  );
  if (!overlay) return logo;
  return (
    <Box sx={{ position: "relative", lineHeight: 0 }}>
      {logo}
      {/* The overlay's viewBox (-30 -45 530 175) is the logo's (0 0 411 100) with room around it, so it lines up
          at any size and may spill a little past the logo. */}
      <Box
        component="img"
        src={overlay}
        alt=""
        aria-hidden
        sx={{
          position: "absolute",
          left: `calc(${height} * -0.3)`,
          top: `calc(${height} * -0.45)`,
          height: `calc(${height} * 1.75)`,
          width: "auto",
          pointerEvents: "none",
        }}
      />
    </Box>
  );
}
