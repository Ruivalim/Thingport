import { darken, getContrastRatio, lighten, type Theme } from "@mui/material/styles";
import type { ProviderId } from "../components/Layout/ConfigurationDialog/providerLogos";
import { IMPORT_PROVIDER_INFO } from "./importProviders";
import { THINGPORT_WEBSITE_URL } from "./website";

/** How much a provider leans on a helper: Thingport Grab or FlareSolverr. */
export type Need = "required" | "recommended" | "optional" | "none";

/** What Thingport needs before importing: nothing, the admin's instance key, each user's own sign-in, or both. */
export type SignIn = "none" | "admin" | "user" | "adminUser" | "userOptional";

export type ProviderFacts = {
  site: string;
  /** The page under docs/providers/ on the website. */
  docs: string;
  signIn: SignIn;
  grab: Need;
  flaresolverr: Need;
  collections: boolean;
  likes: boolean;
  profiles: boolean;
  paid: boolean;
};

// Mirrors docs/PROVIDER_SETUP.md's table; the legacy three come first, as everywhere in the docs.
export const PROVIDER_FACTS: Record<ProviderId, ProviderFacts> = {
  makerworld: {
    site: "https://makerworld.com",
    docs: "makerworld",
    signIn: "user",
    grab: "recommended",
    flaresolverr: "optional",
    collections: true,
    likes: false,
    profiles: true,
    paid: false,
  },
  printables: {
    site: "https://www.printables.com",
    docs: "printables",
    signIn: "none",
    grab: "optional",
    flaresolverr: "recommended",
    collections: true,
    likes: true,
    profiles: false,
    paid: false,
  },
  thingiverse: {
    site: "https://www.thingiverse.com",
    docs: "thingiverse",
    signIn: "admin",
    grab: "optional",
    flaresolverr: "recommended",
    collections: true,
    likes: true,
    profiles: false,
    paid: false,
  },
  myminifactory: {
    site: "https://www.myminifactory.com",
    docs: "myminifactory",
    signIn: "adminUser",
    grab: "optional",
    flaresolverr: "recommended",
    collections: true,
    likes: false,
    profiles: false,
    paid: true,
  },
  snapmaker: {
    site: "https://space.snapmaker.com",
    docs: "snapmaker-space",
    signIn: "user",
    grab: "recommended",
    flaresolverr: "none",
    collections: true,
    likes: true,
    profiles: true,
    paid: false,
  },
  makeronline: {
    site: "https://www.makeronline.com",
    docs: "makeronline",
    signIn: "userOptional",
    grab: "required",
    flaresolverr: "none",
    collections: true,
    likes: true,
    profiles: true,
    paid: false,
  },
  crealitycloud: {
    site: "https://www.crealitycloud.com",
    docs: "creality-cloud",
    signIn: "user",
    grab: "recommended",
    flaresolverr: "none",
    collections: true,
    likes: true,
    profiles: true,
    paid: false,
  },
  nexprint: {
    site: "https://www.nexprint.com",
    docs: "nexprint",
    signIn: "user",
    grab: "recommended",
    flaresolverr: "none",
    collections: true,
    likes: false,
    profiles: true,
    paid: false,
  },
  thangs: {
    site: "https://thangs.com",
    docs: "thangs",
    signIn: "user",
    grab: "recommended",
    flaresolverr: "optional",
    collections: true,
    likes: true,
    profiles: false,
    paid: true,
  },
  cults3d: {
    site: "https://cults3d.com",
    docs: "cults3d",
    signIn: "user",
    grab: "recommended",
    flaresolverr: "none",
    collections: true,
    likes: true,
    profiles: false,
    paid: true,
  },
};

export const PROVIDER_ORDER = Object.keys(PROVIDER_FACTS) as ProviderId[];

export const providerDocsUrl = (id: ProviderId) => `${THINGPORT_WEBSITE_URL}docs/providers/${PROVIDER_FACTS[id].docs}/`;

/** The provider's brand colour; the black-and-white marks take the text colour, so they show in both themes. */
export function providerAccent(id: ProviderId, theme: Theme): string {
  const { color } = IMPORT_PROVIDER_INFO[id];
  return color.startsWith("#") ? color : theme.palette.text.primary;
}

/** The accent as text or a thin mark on the paper: brand colours like Thangs' yellow on white, or Cults3D's purple on
 *  navy, are shifted until they read (WCAG's 3:1 for large text and icons). */
export function providerAccentText(id: ProviderId, theme: Theme): string {
  const paper = theme.palette.background.paper;
  const shift = theme.palette.mode === "dark" ? lighten : darken;
  let color = providerAccent(id, theme);
  for (let step = 0; step < 6 && getContrastRatio(color, paper) < 3.5; step++) color = shift(color, 0.15);
  return color;
}
