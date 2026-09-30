// Published to the fixed "extension-latest" tag, which the release workflow moves on every build,
// rather than the repo-wide "latest" release that Bridge uses.
const EXTENSION_RELEASE_BASE = "https://github.com/TautvydasDerzinskas/Thingport/releases/download/extension-latest";

export type ExtensionDownload =
  | { kind: "file"; browser: "chrome"; label: string; asset: string }
  | { kind: "store"; browser: "edge" | "firefox"; label: string; storeUrl: string };

export type ExtensionFileBrowser = Extract<ExtensionDownload, { kind: "file" }>["browser"];

// The Edge zip and Firefox .xpi are still on every release, but the self-updating store versions
// are the ones to recommend.
export const EDGE_ADDONS_URL = "https://microsoftedge.microsoft.com/addons/detail/kahfidpmojfocohinlmglnfoaimocbol";
export const FIREFOX_ADDONS_URL = "https://addons.mozilla.org/firefox/addon/thingport-grab/";

export const EXTENSION_DOWNLOADS: ExtensionDownload[] = [
  { kind: "store", browser: "firefox", label: "Firefox", storeUrl: FIREFOX_ADDONS_URL },
  { kind: "store", browser: "edge", label: "Edge", storeUrl: EDGE_ADDONS_URL },
  { kind: "file", browser: "chrome", label: "Chrome", asset: "thingport-grab-chrome.zip" },
];

export function extensionDownloadUrl(asset: string): string {
  return `${EXTENSION_RELEASE_BASE}/${asset}`;
}
