// Sites Grab works on only once the user allows it. A new provider every week, each added to the manifest, would
// have the browser disable Grab for everyone after every update until they approved it again. So access to these is
// asked for once, at runtime, for all sites (the manifest's optional_host_permissions), and each release just
// registers the content script for its new site. It only ever runs on the sites listed here.

export type OptionalSite = { id: "myminifactory"; name: string; origins: string[] };

export const OPTIONAL_SITES: readonly OptionalSite[] = [
  { id: "myminifactory", name: "MyMiniFactory", origins: ["*://*.myminifactory.com/*"] },
];

/** What the popup's one-time button asks for: every site, so sites added in later updates need no new prompt. */
export const ALL_SITES_ORIGINS = ["*://*/*"];

const scriptId = (site: OptionalSite) => `site-${site.id}`;

export function siteEnabled(site: OptionalSite): Promise<boolean> {
  return chrome.permissions.contains({ origins: site.origins });
}

/** The sites Grab can't run on yet: none once all-sites access is granted, or after only some were. */
export async function sitesWithoutAccess(): Promise<OptionalSite[]> {
  const access = await Promise.all(OPTIONAL_SITES.map(siteEnabled));
  return OPTIONAL_SITES.filter((_, index) => !access[index]);
}

/** Registers the content script for every site whose access is granted, and drops it for the rest. Safe to run
 *  any time: from startup, and whenever access is granted or taken back, in the browser's own settings too. */
export async function syncSiteScripts(): Promise<void> {
  const registered = new Set((await chrome.scripting.getRegisteredContentScripts()).map((script) => script.id));
  for (const site of OPTIONAL_SITES) {
    const id = scriptId(site);
    const granted = await siteEnabled(site);
    try {
      if (granted && !registered.has(id)) {
        await chrome.scripting.registerContentScripts([
          { id, matches: site.origins, js: ["content.js"], runAt: "document_idle" },
        ]);
      } else if (!granted && registered.has(id)) {
        await chrome.scripting.unregisterContentScripts({ ids: [id] });
      }
    } catch (err) {
      // Two wake-ups racing to register the same script; the other one did it.
      console.warn(`[sites] ${site.id}:`, err);
    }
  }
}

/** Runs Grab in the site's tabs already open: a registration only reaches pages loaded after it. The content
 *  script guards against running twice. */
export async function injectIntoOpenTabs(site: OptionalSite): Promise<void> {
  const tabs = await chrome.tabs.query({ url: site.origins });
  await Promise.all(
    tabs.map((tab) =>
      tab.id == null
        ? undefined
        : chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => undefined),
    ),
  );
}
