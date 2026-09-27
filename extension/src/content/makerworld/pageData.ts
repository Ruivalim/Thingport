// Reading MakerWorld's own page data (Next.js's __NEXT_DATA__) for the model the page shows.

import { parseMakerworldModelUrl } from "../../shared/urls";

export type MakerworldCreator = { uid?: string | number; name?: string };
export type MakerworldInstance = { id?: string | number; title?: string; instanceCreator?: MakerworldCreator };
export type MakerworldDesign = {
  id?: string | number;
  defaultInstanceId?: string | number;
  designCreator?: MakerworldCreator;
  instances?: MakerworldInstance[];
};

/** Which print profiles an import takes -- the panel's "Print profiles" choice. Same meaning as the
 *  backend's MakerworldProfileScope. */
export type MakerworldProfileScope = "url" | "designer" | "all";
export type MakerworldPage = { design: MakerworldDesign; nonce: string | null; requestedInstanceId: string | null };

function readNextData(): unknown {
  const el = document.getElementById("__NEXT_DATA__");
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

function getPath(obj: unknown, ...keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** The design and nonce out of a __NEXT_DATA__ blob, if it's for `designId`. */
function designFromNextData(nextData: unknown, designId: string): Omit<MakerworldPage, "requestedInstanceId"> | null {
  const design = getPath(nextData, "props", "pageProps", "design") as MakerworldDesign | undefined;
  if (!design || typeof design !== "object" || design.id == null || String(design.id) !== designId) return null;
  const nonce = getPath(nextData, "props", "pageProps", "x-nonce");
  return { design, nonce: typeof nonce === "string" && nonce.trim() ? nonce : null };
}

// Page data fetched for models reached by a client-side route change (see
// loadMakerworldDesignForPage), by design id -- for this tab's lifetime.
const fetchedDesigns = new Map<string, Omit<MakerworldPage, "requestedInstanceId">>();

/** The page's MakerWorld design data, or null if missing -- or stale: Next.js only writes
 *  __NEXT_DATA__ on a full page load, so after a client-side route change from one model to
 *  another it still describes the first-loaded design, and resolving from it would pair this
 *  page's metadata with that other model's 3MF. Then the model's own page data, if
 *  loadMakerworldDesignForPage has fetched it. */
export function readMakerworldDesignForPage(pageUrl: string): MakerworldPage | null {
  const expected = parseMakerworldModelUrl(pageUrl);
  if (!expected) return null;
  const found = designFromNextData(readNextData(), expected.designId) ?? fetchedDesigns.get(expected.designId) ?? null;
  return found ? { ...found, requestedInstanceId: expected.requestedInstanceId } : null;
}

const PAGE_FETCH_TIMEOUT_MS = 10000;

/** readMakerworldDesignForPage, fetching the model's own page when the one in the tab is stale --
 *  i.e. when the user got here by clicking through MakerWorld, which is the usual way. The same
 *  request a reload would make (same origin, the user's own session), made once per model: without
 *  it there's no profile list to offer and nothing to resolve downloads from. */
export async function loadMakerworldDesignForPage(pageUrl: string): Promise<MakerworldPage | null> {
  const current = readMakerworldDesignForPage(pageUrl);
  if (current) return current;
  const expected = parseMakerworldModelUrl(pageUrl);
  if (!expected) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl.split("#")[0], { headers: { Accept: "text/html" }, signal: controller.signal });
    if (!res.ok) return null;
    const html = await res.text();
    const el = new DOMParser().parseFromString(html, "text/html").getElementById("__NEXT_DATA__");
    const found = el?.textContent ? designFromNextData(JSON.parse(el.textContent), expected.designId) : null;
    if (!found) return null;
    fetchedDesigns.set(expected.designId, found);
    return { ...found, requestedInstanceId: expected.requestedInstanceId };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Same precedence as the backend's resolveMakerworldViaCloudApi: the requested profile (only if
 *  this design actually has it), then the design's default, then the first one. */
export function pickMakerworldInstanceId(design: MakerworldDesign, requestedInstanceId: string | null): string | null {
  const instances = Array.isArray(design.instances) ? design.instances.filter((inst) => inst && inst.id) : [];
  if (requestedInstanceId && instances.some((inst) => String(inst.id) === requestedInstanceId)) return requestedInstanceId;
  if (design.defaultInstanceId) return String(design.defaultInstanceId);
  return instances.length ? String(instances[0].id) : null;
}

/** Profile ids to import for `scope` -- mirrors the backend's selectMakerworldProfiles: the
 *  link's profile (else the default) first, then the designer's own profiles (a profile whose
 *  instanceCreator is the design's designCreator), or every profile. */
export function makerworldProfileIds(design: MakerworldDesign, scope: MakerworldProfileScope, requestedInstanceId: string | null): string[] {
  const primary = pickMakerworldInstanceId(design, requestedInstanceId);
  if (!primary) return [];
  if (scope === "url") return [primary];
  const designerUid = design.designCreator?.uid != null ? String(design.designCreator.uid) : null;
  const instances = Array.isArray(design.instances) ? design.instances.filter((inst) => inst && inst.id != null) : [];
  const wanted = instances
    .filter((inst) => scope === "all" || (designerUid !== null && inst.instanceCreator?.uid != null && String(inst.instanceCreator.uid) === designerUid))
    .map((inst) => String(inst.id));
  return [primary, ...wanted.filter((id) => id !== primary)];
}

/** The title of the print profile named in the page URL's hash -- null when there's no hash or
 *  the page data is stale (see readMakerworldDesignForPage). */
export function currentMakerworldProfileTitle(pageUrl: string): string | null {
  const page = readMakerworldDesignForPage(pageUrl);
  if (!page || !page.requestedInstanceId || !Array.isArray(page.design.instances)) return null;
  const instance = page.design.instances.find((inst) => inst && String(inst.id) === page.requestedInstanceId);
  return instance && typeof instance.title === "string" && instance.title.trim() ? instance.title.trim() : null;
}
