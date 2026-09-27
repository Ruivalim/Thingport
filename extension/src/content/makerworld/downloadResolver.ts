// MakerWorld client-side download-URL resolution.
//
// Resolves a model's actual file URL from the live page instead of asking the backend to (the
// backend's tryMakerworldCloudApi/resolveMakerworldDownloadUrl both call MakerWorld's resolution
// APIs, the only two places able to trip its CAPTCHA and the resulting 2-hour account-wide lockout,
// see makerworldCaptcha.ts). Doing it here has two real advantages: the fetch is same-origin, so
// the browser attaches the real, current session cookie automatically, and the request looks
// exactly like the page's own JS making it rather than a batch from one server IP. Falls through to
// null on any failure -- a pure enhancement; the backend then resolves it exactly as it always has.

import type { ResolvedDownload } from "../../shared/messages";
import { send } from "../../shared/messages";
import { parseMakerworldModelUrl } from "../../shared/urls";
import { pickMakerworldInstanceId, readMakerworldDesignForPage } from "./pageData";

// Mirrors every outbound fetch on the backend side (all built on an AbortController timeout) -- a
// plain fetch() has no timeout at all, so a MakerWorld endpoint that stalls or holds an interactive
// challenge open (observed live on a model with extra download options) would otherwise hang this
// resolution -- and everything waiting on it, up to the guided job itself -- forever.
const MAKERWORLD_API_FETCH_TIMEOUT_MS = 8000;

/** Same field shape the backend's extractDownloadUrlFromResponse checks -- a plain
 *  {url|downloadUrl|download_url}, optionally nested one level under `data`. */
function extractDownloadUrl(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const candidates = [data as Record<string, unknown>];
  const inner = (data as Record<string, unknown>).data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) candidates.push(inner as Record<string, unknown>);
  for (const obj of candidates) {
    for (const key of ["url", "downloadUrl", "download_url"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

async function fetchMakerworldApiJson(url: string, nonce: string | null): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAKERWORLD_API_FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (nonce) headers["X-Nonce"] = nonce;
    // credentials default to "same-origin" -- the real session cookie rides along automatically.
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Best-effort match for the page's own "Download" button -- text-based (MakerWorld's class names
 *  are build hashes that change on redeploy), visible elements only so a hidden duplicate (e.g. in
 *  an unopened dropdown) isn't clicked instead. With several design "instances", the first match is
 *  the default/selected one. */
function findDownloadButton(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>("button, a")) {
    if (!/^download$/i.test((el.textContent || "").trim())) continue;
    if (el.offsetParent === null) continue; // hidden (display:none or detached)
    return el;
  }
  return null;
}

/** Clicks the page's real Download button and captures the resulting download's URL, canceling it
 *  immediately (see background/downloadCapture.ts). Null when there's no button, nothing was
 *  captured in time, or it was a blob: URL -- always "try the fallback", never a thrown error. */
async function captureViaRealClick(): Promise<string | null> {
  const button = findDownloadButton();
  if (!button) return null;
  const armed = await send("ARM_DOWNLOAD_CAPTURE");
  if (!armed || !armed.ok) return null;
  button.click();
  const res = await send("AWAIT_DOWNLOAD_CAPTURE");
  return res && res.ok ? res.data : null;
}

async function fetchInstanceDownloadUrl(instanceId: string, nonce: string | null): Promise<string | null> {
  const apiUrl = `https://makerworld.com/api/v1/design-service/instance/${instanceId}/f3mf?type=download&fileType=`;
  return extractDownloadUrl(await fetchMakerworldApiJson(apiUrl, nonce));
}

/** Mirrors the backend's two-step resolution (importResolvers.ts's resolveMakerworldDownloadUrl)
 *  -- instance-scoped endpoint first, model-scoped as a fallback -- run from the page instead. */
async function resolveFromPageApi(pageUrl: string): Promise<ResolvedDownload | null> {
  const page = readMakerworldDesignForPage(pageUrl);
  if (!page) return null; // stale or missing page data -- let the backend resolve from the URL
  const { design, nonce } = page;
  const instanceId = pickMakerworldInstanceId(design, page.requestedInstanceId);
  if (instanceId) {
    const downloadUrl = await fetchInstanceDownloadUrl(instanceId, nonce);
    if (downloadUrl) return { downloadUrl, instanceId };
  }
  // Model-level, i.e. the default profile's file.
  const apiUrl = `https://makerworld.com/api/v1/models/${String(design.id)}/download`;
  const downloadUrl = extractDownloadUrl(await fetchMakerworldApiJson(apiUrl, nonce));
  return downloadUrl ? { downloadUrl, instanceId: pickMakerworldInstanceId(design, null) } : null;
}

/** The single entry point: tries the real-click capture first (not a guess, so far higher
 *  fidelity), falling back to reconstructing the API call. `pageUrl` is the model page the caller
 *  means to import, captured before any await. */
export async function resolveMakerworldDownloadUrl(pageUrl: string): Promise<ResolvedDownload | null> {
  const viaClick = await captureViaRealClick().catch(() => null);
  if (viaClick) {
    // The page's button downloads whichever profile the page has selected, which follows the URL
    // hash. Without trustworthy page data, the hash is all there is to go on.
    const page = readMakerworldDesignForPage(pageUrl);
    if (!page) return { downloadUrl: viaClick, instanceId: parseMakerworldModelUrl(pageUrl)?.requestedInstanceId ?? null };
    return { downloadUrl: viaClick, instanceId: pickMakerworldInstanceId(page.design, page.requestedInstanceId) };
  }
  return resolveFromPageApi(pageUrl).catch(() => null);
}

/** One particular print profile's file, resolved from the page like the rest (for importing
 *  several profiles -- the page's Download button only ever gives the selected one). Null when it
 *  can't be; the backend then resolves that profile from a #profileId- link itself. */
export async function resolveMakerworldProfileDownload(pageUrl: string, instanceId: string): Promise<ResolvedDownload | null> {
  const page = readMakerworldDesignForPage(pageUrl);
  if (!page) return null;
  const downloadUrl = await fetchInstanceDownloadUrl(instanceId, page.nonce).catch(() => null);
  return downloadUrl ? { downloadUrl, instanceId } : null;
}
