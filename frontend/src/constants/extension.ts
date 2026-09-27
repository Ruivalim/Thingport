// Thingport Grab is a browser extension (source in /extension, built by
// .github/workflows/extension-release.yml) that imports MakerWorld/Thingiverse/Printables models
// straight from their own pages -- see extension/README.md. Unlike Bridge's own release (which
// GitHub's "latest release" points at), this one publishes to a fixed tag, "extension-latest",
// rather than claiming that same repo-wide "latest" slot -- see the release workflow's own
// comment for why. That makes this a tag-scoped download path, not the /releases/latest/ alias
// bridge.ts uses, but it's equally stable: the workflow moves this tag to point at its newest
// build on every release rather than ever making a new one.
const EXTENSION_RELEASE_BASE = "https://github.com/TautvydasDerzinskas/Thingport/releases/download/extension-latest";

/** A browser whose card links to a file from the release (followed by install steps), or to the
 *  extension's store listing, which installs and updates it like any other extension. */
export type ExtensionDownload =
  | { kind: "file"; browser: "chrome" | "firefox"; label: string; asset: string }
  | { kind: "store"; browser: "edge"; label: string; storeUrl: string };

/** Browsers installed from a downloaded file -- the ones the install-steps dialog covers. */
export type ExtensionFileBrowser = Extract<ExtensionDownload, { kind: "file" }>["browser"];

// Published there by the release workflow's publish-edge job. The Edge zip is still attached to
// every release, but only the docs mention it now (extension/README.md) -- the store version is
// the one to recommend, since it updates itself.
export const EDGE_ADDONS_URL = "https://microsoftedge.microsoft.com/addons/detail/kahfidpmojfocohinlmglnfoaimocbol";

// Firefox's asset is a Mozilla-signed .xpi rather than a zip -- see extension/README.md's
// "Firefox" install section for why an unpacked zip won't do there.
export const EXTENSION_DOWNLOADS: ExtensionDownload[] = [
  { kind: "file", browser: "chrome", label: "Chrome", asset: "thingport-grab-chrome.zip" },
  { kind: "store", browser: "edge", label: "Edge", storeUrl: EDGE_ADDONS_URL },
  { kind: "file", browser: "firefox", label: "Firefox", asset: "thingport-grab-firefox.xpi" },
];

export function extensionDownloadUrl(asset: string): string {
  return `${EXTENSION_RELEASE_BASE}/${asset}`;
}
