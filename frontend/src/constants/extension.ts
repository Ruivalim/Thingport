// Published to the fixed "extension-latest" tag, which the release workflow moves on every build,
// rather than the repo-wide "latest" release that Bridge uses.
const EXTENSION_RELEASE_BASE = "https://github.com/TautvydasDerzinskas/Thingport/releases/download/extension-latest";

export type ExtensionDownload =
  | { kind: "file"; browser: "chrome" | "firefox"; label: string; asset: string }
  | { kind: "store"; browser: "edge"; label: string; storeUrl: string };

export type ExtensionFileBrowser = Extract<ExtensionDownload, { kind: "file" }>["browser"];

// The Edge zip is still on every release, but the self-updating store version is the one to
// recommend.
export const EDGE_ADDONS_URL = "https://microsoftedge.microsoft.com/addons/detail/kahfidpmojfocohinlmglnfoaimocbol";

// Firefox needs the Mozilla-signed .xpi (see extension/README.md).
export const EXTENSION_DOWNLOADS: ExtensionDownload[] = [
  { kind: "file", browser: "chrome", label: "Chrome", asset: "thingport-grab-chrome.zip" },
  { kind: "store", browser: "edge", label: "Edge", storeUrl: EDGE_ADDONS_URL },
  { kind: "file", browser: "firefox", label: "Firefox", asset: "thingport-grab-firefox.xpi" },
];

export function extensionDownloadUrl(asset: string): string {
  return `${EXTENSION_RELEASE_BASE}/${asset}`;
}
