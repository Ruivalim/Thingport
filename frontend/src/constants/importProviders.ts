import type { Theme } from "@mui/material/styles";

// `color`/`textColor` are sx palette tokens or hex brand colors; `textColor` may also be a theme
// callback.
export type ImportProviderInfo = { label: string; color: string; textColor?: string | ((theme: Theme) => string) };

export const IMPORT_PROVIDER_INFO: Record<string, ImportProviderInfo> = {
  makerworld: { label: "MakerWorld", color: "#00B800" },
  thingiverse: { label: "Thingiverse", color: "#2B78FE" },
  printables: { label: "Printables", color: "#FA6831" },
  // A darker shade of MyMiniFactory's #00C4A6, so the white label stays readable.
  myminifactory: { label: "MyMiniFactory", color: "#00866F" },
  // Snapmaker's mark is black and white, so it follows the theme like Thingport's own.
  snapmaker: {
    label: "Snapmaker Space",
    color: "text.primary",
    textColor: (theme) => (theme.palette.mode === "dark" ? "#FFFFFF" : theme.palette.background.paper),
  },
  // MakerOnline's mark is black and white too.
  makeronline: {
    label: "MakerOnline",
    color: "text.primary",
    textColor: (theme) => (theme.palette.mode === "dark" ? "#FFFFFF" : theme.palette.background.paper),
  },
  // Direct uploads (source_provider is null). Monochrome so it doesn't compete with provider badges;
  // dark mode uses flat white for contrast against the chip.
  thingport: {
    label: "Thingport",
    color: "text.primary",
    textColor: (theme) => (theme.palette.mode === "dark" ? "#FFFFFF" : theme.palette.background.paper),
  },
};

/** Known external providers only; null for uploads. */
export function importProviderInfo(provider: string | null | undefined): ImportProviderInfo | null {
  if (!provider) return null;
  return IMPORT_PROVIDER_INFO[provider] ?? null;
}

/** Like importProviderInfo, but falls back to "Thingport" for uploads. */
export function printProviderInfo(provider: string | null | undefined): ImportProviderInfo {
  return importProviderInfo(provider) ?? IMPORT_PROVIDER_INFO.thingport;
}
