// Provider URL recognition, duplicated from the frontend and backend parsers. Keep in sync by hand.

export type Provider =
  | "makerworld"
  | "thingiverse"
  | "printables"
  | "myminifactory"
  | "snapmaker"
  | "makeronline"
  | "crealitycloud"
  | "nexprint";

export type Classification =
  | { kind: "single"; provider: "makerworld"; type: "model" }
  | { kind: "single"; provider: "thingiverse"; type: "thing" }
  | { kind: "single"; provider: "printables"; type: "model" }
  | { kind: "single"; provider: "myminifactory"; type: "object" }
  | { kind: "single"; provider: "snapmaker"; type: "model" }
  | { kind: "single"; provider: "makeronline"; type: "model" }
  | { kind: "single"; provider: "crealitycloud"; type: "model" }
  | { kind: "single"; provider: "nexprint"; type: "model" }
  | { kind: "batch"; provider: "makerworld"; type: "collection" }
  | { kind: "batch"; provider: "thingiverse"; type: "likes" | "collection" }
  | { kind: "batch"; provider: "printables"; type: "collection" }
  | { kind: "batch"; provider: "myminifactory"; type: "collection" }
  | { kind: "batch"; provider: "snapmaker"; type: SnapmakerList }
  | { kind: "batch"; provider: "makeronline"; type: "collection" | "likes" }
  | { kind: "batch"; provider: "crealitycloud"; type: "collection" | "likes" }
  | { kind: "batch"; provider: "nexprint"; type: "collection" };

export type SnapmakerList = "likes" | "bookmarks";

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isHost(parsed: URL, domain: string): boolean {
  const host = parsed.hostname.toLowerCase();
  return host === domain || host === `www.${domain}`;
}

export function parseMakerworldModelUrl(url: string): { designId: string; requestedInstanceId: string | null } | null {
  const parsed = parse(url);
  if (!parsed || !parsed.hostname.toLowerCase().endsWith("makerworld.com")) return null;
  const m = parsed.pathname.match(/\/models?\/(\d+)/i);
  if (!m) return null;
  const hashMatch = parsed.hash.match(/profileid-(\d+)/i);
  return { designId: m[1], requestedInstanceId: hashMatch ? hashMatch[1] : null };
}

/** Mirrors the backend's buildImportSourceUrl. */
export function makerworldModelUrl(designId: string): string {
  return `https://makerworld.com/en/models/${designId}`;
}

export function isMakerworldCollectionUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(
    parsed && parsed.hostname.toLowerCase().endsWith("makerworld.com") && /\/collections\/\d+/i.test(parsed.pathname),
  );
}

export function isMakerworldUrl(url: string | undefined | null): boolean {
  return Boolean(url) && (Boolean(parseMakerworldModelUrl(url!)) || isMakerworldCollectionUrl(url!));
}

export function parseThingiverseThingUrl(url: string): { thingId: string } | null {
  const parsed = parse(url);
  if (!parsed || !isHost(parsed, "thingiverse.com")) return null;
  const m = parsed.pathname.match(/thing:(\d+)/i) ?? parsed.pathname.match(/\/things\/(\d+)/i);
  return m ? { thingId: m[1] } : null;
}

export function isThingiverseLikesUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(parsed && isHost(parsed, "thingiverse.com") && /^\/[^/]+\/likes\/?$/i.test(parsed.pathname));
}

export function isThingiverseCollectionUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(parsed && isHost(parsed, "thingiverse.com") && /\/collections\/\d+/i.test(parsed.pathname));
}

export function parsePrintablesModelUrl(url: string): { modelId: string } | null {
  const parsed = parse(url);
  if (!parsed || !isHost(parsed, "printables.com")) return null;
  const m = parsed.pathname.match(/\/model\/(\d+)/i);
  return m ? { modelId: m[1] } : null;
}

export function isPrintablesCollectionUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(parsed && isHost(parsed, "printables.com") && /\/collections\/\d+/i.test(parsed.pathname));
}

/** `/object/3d-print-<slug>-<id>`, optionally behind a language prefix (`/it/object/...`). */
export function parseMyminifactoryObjectUrl(url: string): { objectId: string } | null {
  const parsed = parse(url);
  if (!parsed || !isHost(parsed, "myminifactory.com")) return null;
  const m = parsed.pathname.match(/^\/(?:[a-z]{2}\/)?object\/(?:[^/]*-)?(\d+)\/?$/i);
  return m ? { objectId: m[1] } : null;
}

export function isMyminifactoryCollectionUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(
    parsed &&
    isHost(parsed, "myminifactory.com") &&
    /^\/(?:[a-z]{2}\/)?users\/[^/]+\/collection\/[^/]+\/?$/i.test(parsed.pathname),
  );
}

function isSnapmaker(parsed: URL): boolean {
  return parsed.hostname.toLowerCase() === "space.snapmaker.com";
}

/** `/en/model/<id>-<slug>`; `#profileId-<id>` picks a print profile. */
export function parseSnapmakerModelUrl(url: string): { modelId: string; requestedProfileId: string | null } | null {
  const parsed = parse(url);
  if (!parsed || !isSnapmaker(parsed)) return null;
  const m = parsed.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?model\/(\d+)(?:-[^/]*)?\/?$/i);
  if (!m) return null;
  return { modelId: m[1], requestedProfileId: parsed.hash.match(/profileId-(\d+)/i)?.[1] ?? null };
}

/** The user's likes and bookmarks share one page, `/creator/<id>?tab=interactions`, whose address stays the same
 *  whichever is shown; `list` in the address tells them apart where Thingport keeps it. */
export function parseSnapmakerListUrl(url: string): { userId: string; list: SnapmakerList } | null {
  const parsed = parse(url);
  if (!parsed || !isSnapmaker(parsed) || parsed.searchParams.get("tab") !== "interactions") return null;
  const m = parsed.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?creator\/(\d+)\/?$/i);
  if (!m) return null;
  return { userId: m[1], list: parsed.searchParams.get("list") === "bookmarks" ? "bookmarks" : "likes" };
}

/** Mirrors the backend's snapmakerListUrl. */
export function snapmakerListUrl(userId: string, list: SnapmakerList): string {
  return `https://space.snapmaker.com/en/creator/${userId}?tab=interactions&list=${list}`;
}

function isMakeronline(parsed: URL): boolean {
  return /^(www\.)?makeronline\.com$/i.test(parsed.hostname);
}

const MAKERONLINE_LANG = String.raw`(?:[a-z]{2}(?:[-_][a-z]{2})?/)?`;

/** `/en/model/<title>/<id>.html`; Thingport's own `#profileId-<id>` picks a print profile. */
export function parseMakeronlineModelUrl(url: string): { modelId: string; requestedProfileId: string | null } | null {
  const parsed = parse(url);
  if (!parsed || !isMakeronline(parsed)) return null;
  const m = parsed.pathname.match(
    new RegExp(String.raw`^/${MAKERONLINE_LANG}model/(?:[^/]+/)?(\d+)(?:\.html)?/?$`, "i"),
  );
  if (!m) return null;
  return { modelId: m[1], requestedProfileId: parsed.hash.match(/profileId-(\d+)/i)?.[1] ?? null };
}

/** `/en/user/collectionDetail/<owner id>/<collection id>.html`. */
export function isMakeronlineCollectionUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(
    parsed &&
    isMakeronline(parsed) &&
    new RegExp(String.raw`^/${MAKERONLINE_LANG}user/collectionDetail/(?:[\w-]+/)?\d+(?:\.html)?/?$`, "i").test(
      parsed.pathname,
    ),
  );
}

/** The signed-in user's likes, `/en/user/likes/models.html`. */
export function isMakeronlineLikesUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(
    parsed &&
    isMakeronline(parsed) &&
    new RegExp(String.raw`^/${MAKERONLINE_LANG}user/likes/models(?:\.html)?/?$`, "i").test(parsed.pathname),
  );
}

function isCrealitycloud(parsed: URL): boolean {
  return /^(www\.)?crealitycloud\.com$/i.test(parsed.hostname);
}

const CREALITYCLOUD_LANG = String.raw`(?:[a-z]{2}(?:-[a-z]{2,4})?/)?`;

/** `/model-detail/<alias>`, the alias made of the model's title; Thingport's own `#profileId-<id>` picks a print
 *  profile. */
export function parseCrealitycloudModelUrl(url: string): { modelId: string; requestedProfileId: string | null } | null {
  const parsed = parse(url);
  if (!parsed || !isCrealitycloud(parsed)) return null;
  const m = parsed.pathname.match(new RegExp(String.raw`^/${CREALITYCLOUD_LANG}model-detail/([\w-]+)/?$`, "i"));
  if (!m) return null;
  return {
    modelId: m[1].toLowerCase(),
    requestedProfileId: parsed.hash.match(/profileId-([0-9a-f]{24})/i)?.[1]?.toLowerCase() ?? null,
  };
}

/** `/collection/<alias>`. */
export function isCrealitycloudCollectionUrl(url: string): boolean {
  const parsed = parse(url);
  return Boolean(
    parsed &&
    isCrealitycloud(parsed) &&
    new RegExp(String.raw`^/${CREALITYCLOUD_LANG}collection/[\w-]+/?$`, "i").test(parsed.pathname),
  );
}

/** The user's likes, `/user/<id>/likes`; Creality Cloud shows them to their owner only. */
export function parseCrealitycloudLikesUrl(url: string): { userId: string } | null {
  const parsed = parse(url);
  if (!parsed || !isCrealitycloud(parsed)) return null;
  const m = parsed.pathname.match(new RegExp(String.raw`^/${CREALITYCLOUD_LANG}user/(\d+)/likes/?$`, "i"));
  return m ? { userId: m[1] } : null;
}

function isNexprint(parsed: URL): boolean {
  return /^(www\.)?nexprint\.com$/i.test(parsed.hostname);
}

const NEXPRINT_LANG = String.raw`(?:[a-z]{2}(?:-[a-z]{2,4})?/)?`;

/** `/en/models/<id>`; `?printConfigId=<id>` names a print profile, as do Thingport's own `#profileId-<id>` links. */
export function parseNexprintModelUrl(url: string): { modelId: string; requestedProfileId: string | null } | null {
  const parsed = parse(url);
  if (!parsed || !isNexprint(parsed)) return null;
  const m = parsed.pathname.match(new RegExp(String.raw`^/${NEXPRINT_LANG}models/(G\d+)/?$`, "i"));
  if (!m) return null;
  const profile = parsed.hash.match(/profileId-(G\d+)/i)?.[1] ?? parsed.searchParams.get("printConfigId");
  return {
    modelId: m[1].toUpperCase(),
    requestedProfileId: profile && /^G\d+$/i.test(profile) ? profile.toUpperCase() : null,
  };
}

/** A collection: `/en/collection/<id>`, or open on its owner's page (`/en/<user>/home?...&collectionId=<id>`). */
export function isNexprintCollectionUrl(url: string): boolean {
  const parsed = parse(url);
  if (!parsed || !isNexprint(parsed)) return false;
  if (new RegExp(String.raw`^/${NEXPRINT_LANG}collection/G\d+/?$`, "i").test(parsed.pathname)) return true;
  return (
    new RegExp(String.raw`^/${NEXPRINT_LANG}U\d+/home/?$`, "i").test(parsed.pathname) &&
    /^G\d+$/i.test(parsed.searchParams.get("collectionId") ?? "")
  );
}

/** Null keeps the icon hidden. "single" pages get a dedup check; "batch" pages always show it. */
export function classifyUrl(url: string): Classification | null {
  if (isMakerworldCollectionUrl(url)) return { kind: "batch", provider: "makerworld", type: "collection" };
  if (isThingiverseLikesUrl(url)) return { kind: "batch", provider: "thingiverse", type: "likes" };
  if (isThingiverseCollectionUrl(url)) return { kind: "batch", provider: "thingiverse", type: "collection" };
  if (isPrintablesCollectionUrl(url)) return { kind: "batch", provider: "printables", type: "collection" };
  if (isMyminifactoryCollectionUrl(url)) return { kind: "batch", provider: "myminifactory", type: "collection" };
  const snapmakerList = parseSnapmakerListUrl(url);
  if (snapmakerList) return { kind: "batch", provider: "snapmaker", type: snapmakerList.list };
  if (isMakeronlineCollectionUrl(url)) return { kind: "batch", provider: "makeronline", type: "collection" };
  if (isMakeronlineLikesUrl(url)) return { kind: "batch", provider: "makeronline", type: "likes" };
  if (isCrealitycloudCollectionUrl(url)) return { kind: "batch", provider: "crealitycloud", type: "collection" };
  if (parseCrealitycloudLikesUrl(url)) return { kind: "batch", provider: "crealitycloud", type: "likes" };
  if (isNexprintCollectionUrl(url)) return { kind: "batch", provider: "nexprint", type: "collection" };
  if (parseMakerworldModelUrl(url)) return { kind: "single", provider: "makerworld", type: "model" };
  if (parseThingiverseThingUrl(url)) return { kind: "single", provider: "thingiverse", type: "thing" };
  if (parsePrintablesModelUrl(url)) return { kind: "single", provider: "printables", type: "model" };
  if (parseMyminifactoryObjectUrl(url)) return { kind: "single", provider: "myminifactory", type: "object" };
  if (parseSnapmakerModelUrl(url)) return { kind: "single", provider: "snapmaker", type: "model" };
  if (parseMakeronlineModelUrl(url)) return { kind: "single", provider: "makeronline", type: "model" };
  if (parseCrealitycloudModelUrl(url)) return { kind: "single", provider: "crealitycloud", type: "model" };
  if (parseNexprintModelUrl(url)) return { kind: "single", provider: "nexprint", type: "model" };
  return null;
}
