// Resolves the MakerWorld file URL in the page instead of the backend, whose resolution calls are
// what trip MakerWorld's account-wide CAPTCHA. Same-origin fetches carry the real session and look
// like the page's own traffic. Returns null on any failure so the backend can resolve it instead.

import type { ResolvedDownload } from "../../shared/messages";
import { send } from "../../shared/messages";
import { parseMakerworldModelUrl } from "../../shared/urls";
import {
  loadMakerworldDesignForPage,
  makerworldDesignForImport,
  pickMakerworldInstanceId,
  readMakerworldDesignForPage,
  type MakerworldDesign,
} from "./pageData";

// fetch() has no timeout, and some endpoints hold an interactive challenge open indefinitely.
const MAKERWORLD_API_FETCH_TIMEOUT_MS = 8000;

// What MakerWorld's own web client sends with its API calls; it answers 403 without them.
const MAKERWORLD_CLIENT_HEADERS = {
  "X-BBL-Client-Name": "MakerWorld",
  "X-BBL-Client-Type": "web",
  "X-BBL-Client-Version": "00.00.00.01",
  "X-BBL-App-Source": "makerworld",
};

/** {url|downloadUrl|download_url}, optionally nested under `data`. */
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
    const headers: Record<string, string> = { Accept: "application/json", ...MAKERWORLD_CLIENT_HEADERS };
    if (nonce) headers["X-Nonce"] = nonce;
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Matched by text (class names are build hashes), visible elements only. */
function findDownloadButton(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>("button, a")) {
    if (!/^download$/i.test((el.textContent || "").trim())) continue;
    if (el.offsetParent === null) continue; // hidden (display:none or detached)
    return el;
  }
  return null;
}

/** Captures and cancels the download the real button starts (see background/downloadCapture.ts).
 *  Null means try the fallback. */
async function captureViaRealClick(): Promise<string | null> {
  const button = findDownloadButton();
  if (!button) return null;
  const armed = await send("ARM_DOWNLOAD_CAPTURE");
  if (!armed || !armed.ok) return null;
  button.click();
  const res = await send("AWAIT_DOWNLOAD_CAPTURE");
  return res && res.ok ? res.data : null;
}

/** The printer the profile was made for, which MakerWorld's own download request names. */
function instanceDevModelName(design: MakerworldDesign, instanceId: string): string {
  const instance = design.instances?.find((inst) => inst && String(inst.id) === instanceId) as
    Record<string, unknown> | undefined;
  const extension = instance?.extention as { modelInfo?: { compatibility?: { devModelName?: unknown } } } | undefined;
  const name = extension?.modelInfo?.compatibility?.devModelName;
  return typeof name === "string" ? name : "";
}

/** Sent exactly as MakerWorld's own "Download 3MF" sends it. */
async function fetchInstanceDownloadUrl(design: MakerworldDesign, instanceId: string): Promise<string | null> {
  const devModelName = encodeURIComponent(instanceDevModelName(design, instanceId));
  const apiUrl = `https://makerworld.com/api/v1/design-service/instance/${instanceId}/f3mf?type=download&fileType=&devModelName=${devModelName}`;
  return extractDownloadUrl(await fetchMakerworldApiJson(apiUrl, null));
}

/** Same two steps as the backend: instance-scoped endpoint, then model-scoped. */
async function resolveFromPageApi(pageUrl: string): Promise<ResolvedDownload | null> {
  // Fetched when the tab's own page data is stale, i.e. after clicking through MakerWorld.
  const page = await loadMakerworldDesignForPage(pageUrl);
  if (!page) return null; // the backend resolves from the URL
  const { design, nonce } = page;
  const instanceId = pickMakerworldInstanceId(design, page.requestedInstanceId);
  if (instanceId) {
    const downloadUrl = await fetchInstanceDownloadUrl(design, instanceId);
    if (downloadUrl) return { downloadUrl, instanceId, design: makerworldDesignForImport(design) };
  }
  // Model-level, i.e. the default profile's file.
  const apiUrl = `https://makerworld.com/api/v1/models/${String(design.id)}/download`;
  const downloadUrl = extractDownloadUrl(await fetchMakerworldApiJson(apiUrl, nonce));
  return downloadUrl
    ? { downloadUrl, instanceId: pickMakerworldInstanceId(design, null), design: makerworldDesignForImport(design) }
    : null;
}

/** `pageUrl` is captured by the caller before any await. */
export async function resolveMakerworldDownloadUrl(pageUrl: string): Promise<ResolvedDownload | null> {
  const viaClick = await captureViaRealClick().catch(() => null);
  if (viaClick) {
    // The button downloads the page's selected profile, which follows the URL hash.
    const page = readMakerworldDesignForPage(pageUrl);
    if (!page)
      return { downloadUrl: viaClick, instanceId: parseMakerworldModelUrl(pageUrl)?.requestedInstanceId ?? null };
    return {
      downloadUrl: viaClick,
      instanceId: pickMakerworldInstanceId(page.design, page.requestedInstanceId),
      design: makerworldDesignForImport(page.design),
    };
  }
  return resolveFromPageApi(pageUrl).catch(() => null);
}

/** The Download button only gives the selected profile, so other profiles resolve via the API. */
export async function resolveMakerworldProfileDownload(
  pageUrl: string,
  instanceId: string,
): Promise<ResolvedDownload | null> {
  const page = await loadMakerworldDesignForPage(pageUrl);
  if (!page) return null;
  const downloadUrl = await fetchInstanceDownloadUrl(page.design, instanceId).catch(() => null);
  return downloadUrl ? { downloadUrl, instanceId, design: makerworldDesignForImport(page.design) } : null;
}
