import type { Theme } from "@mui/material/styles";

// `color`/`textColor` are sx palette tokens or hex brand colors; `textColor` may also be a theme
// callback. `outlined` adds a primary-colour ring.
export type ImportProviderInfo = {
  label: string;
  color: string;
  textColor?: string | ((theme: Theme) => string);
  outlined?: boolean;
};

export const IMPORT_PROVIDER_INFO: Record<string, ImportProviderInfo> = {
  makerworld: { label: "MakerWorld", color: "#00B800" },
  thingiverse: { label: "Thingiverse", color: "#2B78FE" },
  printables: { label: "Printables", color: "#FA6831" },
  // A darker shade of MyMiniFactory's #00C4A6, so the white label stays readable.
  myminifactory: { label: "MyMiniFactory", color: "#00866F" },
  snapmaker: { label: "Snapmaker Space", color: "#0C63E2" },
  // MakerOnline's mark is black and white, so it follows the theme.
  makeronline: {
    label: "MakerOnline",
    color: "text.primary",
    textColor: (theme) => (theme.palette.mode === "dark" ? "#FFFFFF" : theme.palette.background.paper),
  },
  crealitycloud: { label: "Creality Cloud", color: "#1AC686" },
  nexprint: { label: "NexPrint", color: "#7A55E3" },
  // Thangs' own yellow is too light for white text, so its badge text is dark in both themes.
  thangs: { label: "Thangs", color: "#FFBC00", textColor: "common.black" },
  cults3d: { label: "Cults3D", color: "#822EF5" },
  // Direct uploads (source_provider is null).
  thingport: { label: "Thingport", color: "common.white", textColor: "common.black", outlined: true },
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

/** The fill, text and ring of a provider chip. */
export function providerChipSx(info: ImportProviderInfo) {
  return {
    bgcolor: info.color,
    color: info.textColor ?? "#fff",
    // An inset ring, so the outlined chip stays the same size as the others.
    ...(info.outlined && { boxShadow: (theme: Theme) => `inset 0 0 0 1.5px ${theme.palette.primary.main}` }),
  };
}
