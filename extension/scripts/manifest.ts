// Generates each browser's manifest.json from one definition. Chrome and Edge run the background as
// an MV3 service worker; Firefox has no extension service workers and runs the same bundle as an
// event page via background.scripts, plus its own gecko settings.

export const TARGETS = ["chrome", "firefox", "edge"] as const;
export type Target = (typeof TARGETS)[number];

export function isTarget(value: string): value is Target {
  return (TARGETS as readonly string[]).includes(value);
}

const PROVIDER_MATCHES = ["*://*.thingiverse.com/*", "*://*.makerworld.com/*", "*://*.printables.com/*"];

function iconSet(variant: "color" | "dark"): Record<string, string> {
  return Object.fromEntries([16, 32, 48, 128].map((size) => [String(size), `icons/thingport-icon-${variant}-${size}.png`]));
}

export function buildManifest(target: Target, pkg: { version: string; description: string }): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    manifest_version: 3,
    name: "Thingport Grab",
    version: pkg.version,
    description: pkg.description,
    icons: iconSet("color"),
    action: {
      default_popup: "popup.html",
      // Dark/inactive until a page shows the floating icon -- see background/tabIcon.ts.
      default_icon: iconSet("dark"),
    },
    background: target === "firefox" ? { scripts: ["background.js"] } : { service_worker: "background.js" },
    permissions: ["storage", "tabs", "cookies", "downloads"],
    // The user's own instance origin, requested at setup time (see popup/index.ts).
    optional_host_permissions: ["*://*/*"],
    content_scripts: [{ matches: PROVIDER_MATCHES, js: ["content.js"], run_at: "document_idle" }],
  };

  if (target === "firefox") {
    manifest.browser_specific_settings = {
      gecko: {
        // Ties every signed version together as updates of one add-on -- never change it once
        // builds have been distributed (see README).
        id: "grab@thingport.app",
        strict_min_version: "109.0",
        // Only covers data sent to the developer or a third party; the user's own self-hosted
        // instance is neither (see README).
        data_collection_permissions: { required: ["none"] },
      },
    };
  }
  return manifest;
}
