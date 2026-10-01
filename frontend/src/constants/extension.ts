// The self-updating store versions. The zips and Firefox .xpi on the extension-latest release are
// for installing by hand and are only linked from the docs.
export type ExtensionDownload = { browser: "chrome" | "edge" | "firefox"; label: string; storeUrl: string };

export const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/nmblahmglpbplmfcggghdgohohlaeiee";
export const EDGE_ADDONS_URL = "https://microsoftedge.microsoft.com/addons/detail/kahfidpmojfocohinlmglnfoaimocbol";
export const FIREFOX_ADDONS_URL = "https://addons.mozilla.org/firefox/addon/thingport-grab/";

export const EXTENSION_DOWNLOADS: ExtensionDownload[] = [
  { browser: "chrome", label: "Chrome", storeUrl: CHROME_WEB_STORE_URL },
  { browser: "firefox", label: "Firefox", storeUrl: FIREFOX_ADDONS_URL },
  { browser: "edge", label: "Edge", storeUrl: EDGE_ADDONS_URL },
];
