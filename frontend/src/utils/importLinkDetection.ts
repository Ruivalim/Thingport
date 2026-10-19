/** URL-shape detection shared by useUploadImport and AddMenu so they can't drift apart. */

export type ImportProviderKey =
  "makerworld" | "thingiverse" | "printables" | "myminifactory" | "snapmaker" | "makeronline";

function parseUrl(url: string): URL | null {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`);
  } catch {
    return null;
  }
}

export function detectImportProvider(url: string): ImportProviderKey | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (host.endsWith("makerworld.com")) return "makerworld";
  if (host === "thingiverse.com" || host === "www.thingiverse.com") return "thingiverse";
  if (host === "printables.com" || host === "www.printables.com") return "printables";
  if (host === "myminifactory.com" || host === "www.myminifactory.com") return "myminifactory";
  if (host === "space.snapmaker.com") return "snapmaker";
  if (host === "makeronline.com" || host === "www.makeronline.com") return "makeronline";
  return null;
}

/** Collection pages go to the collection picker instead of the single-link flow. */
export function isMakerworldCollectionUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return Boolean(
    parsed && parsed.hostname.toLowerCase().endsWith("makerworld.com") && /\/collections\/\d+/i.test(parsed.pathname),
  );
}

export function isMakerworldModelUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return Boolean(
    parsed && parsed.hostname.toLowerCase().endsWith("makerworld.com") && /\/models?\/\d+/i.test(parsed.pathname),
  );
}

/** Thingiverse and Printables have their own backend import paths, so skip the generic inspect/zip
 * flow for them. */
export function isThingiverseThingUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "thingiverse.com" && host !== "www.thingiverse.com") return false;
  return /thing:\d+/i.test(parsed.pathname) || /\/things\/\d+/i.test(parsed.pathname);
}

export function isThingiverseLikesUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "thingiverse.com" && host !== "www.thingiverse.com") return false;
  return /^\/[^/]+\/likes\/?$/i.test(parsed.pathname);
}

export function isThingiverseCollectionUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "thingiverse.com" && host !== "www.thingiverse.com") return false;
  return /\/collections\/\d+/i.test(parsed.pathname);
}

export function isPrintablesCollectionUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "printables.com" && host !== "www.printables.com") return false;
  return /\/collections\/\d+/i.test(parsed.pathname);
}

/** See isThingiverseThingUrl. */
export function isPrintablesModelUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "printables.com" && host !== "www.printables.com") return false;
  return /\/model\/\d+/i.test(parsed.pathname);
}

/** See isThingiverseThingUrl. A language prefix ("/it/object/...") is allowed. */
export function isMyminifactoryObjectUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "myminifactory.com" && host !== "www.myminifactory.com") return false;
  return /^\/(?:[a-z]{2}\/)?object\/(?:[^/]*-)?\d+\/?$/i.test(parsed.pathname);
}

export function isMyminifactoryCollectionUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "myminifactory.com" && host !== "www.myminifactory.com") return false;
  return /^\/(?:[a-z]{2}\/)?users\/[^/]+\/collection\/[^/]+\/?$/i.test(parsed.pathname);
}

/** See isThingiverseThingUrl. `#profileId-<id>` may pick a print profile. */
export function isSnapmakerModelUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed || parsed.hostname.toLowerCase() !== "space.snapmaker.com") return false;
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?model\/\d+(?:-[^/]*)?\/?$/i.test(parsed.pathname);
}

/** The user's own likes or bookmarks: one page, `/creator/<id>?tab=interactions`, with `list` saying which. */
export function isSnapmakerListUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed || parsed.hostname.toLowerCase() !== "space.snapmaker.com") return false;
  return (
    /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?creator\/\d+\/?$/i.test(parsed.pathname) &&
    parsed.searchParams.get("tab") === "interactions" &&
    ["likes", "bookmarks"].includes(parsed.searchParams.get("list") ?? "")
  );
}

function isMakeronlineHost(parsed: URL): boolean {
  return /^(www\.)?makeronline\.com$/i.test(parsed.hostname);
}

/** See isThingiverseThingUrl. `/en/model/<title>/<id>.html`; `#profileId-<id>` may pick a print profile. */
export function isMakeronlineModelUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed || !isMakeronlineHost(parsed)) return false;
  return /^\/(?:[a-z]{2}(?:[-_][a-z]{2})?\/)?model\/(?:[^/]+\/)?\d+(?:\.html)?\/?$/i.test(parsed.pathname);
}

/** A MakerOnline collection, or the signed-in user's likes (`/en/user/likes/models.html`). */
export function isMakeronlineListUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed || !isMakeronlineHost(parsed)) return false;
  return /^\/(?:[a-z]{2}(?:[-_][a-z]{2})?\/)?user\/(?:collectionDetail\/(?:[\w-]+\/)?\d+|likes\/models)(?:\.html)?\/?$/i.test(
    parsed.pathname,
  );
}

export const IMPORT_LINK_EXAMPLES: Record<ImportProviderKey, { model: string; collection: string }> = {
  makerworld: {
    model: "https://makerworld.com/en/models/123456-example-model",
    collection: "https://makerworld.com/en/collections/12345-example-collection",
  },
  thingiverse: {
    model: "https://www.thingiverse.com/thing:1234567",
    collection: "https://www.thingiverse.com/username/collections/12345-example-collection",
  },
  printables: {
    model: "https://www.printables.com/model/123456-example-model",
    collection: "https://www.printables.com/@username/collections/12345-example-collection",
  },
  myminifactory: {
    model: "https://www.myminifactory.com/object/3d-print-example-model-123456",
    collection: "https://www.myminifactory.com/users/username/collection/example-collection",
  },
  snapmaker: {
    model: "https://space.snapmaker.com/en/model/12345-example-model",
    collection: "https://space.snapmaker.com/en/creator/12345?tab=interactions&list=likes",
  },
  makeronline: {
    model: "https://www.makeronline.com/en/model/Example-Model/123456.html",
    collection: "https://www.makeronline.com/en/user/collectionDetail/…/123456.html",
  },
};
