// Resolves the MakerWorld file URL in the page instead of the backend, whose resolution calls are
// what trip MakerWorld's account-wide CAPTCHA. Same-origin fetches carry the real session and look
// like the page's own traffic. Returns null on any failure so the backend can resolve it instead.

import type { ResolvedDownload } from "../../shared/messages";
import { send } from "../../shared/messages";
import { parseMakerworldModelUrl } from "../../shared/urls";
import { makerworldDesignForImport, pickMakerworldInstanceId, readMakerworldDesignForPage } from "./pageData";

// fetch() has no timeout, and some endpoints hold an interactive challenge open indefinitely.
const MAKERWORLD_API_FETCH_TIMEOUT_MS = 8000;

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
    const headers: Record<string, string> = { Accept: "application/json" };
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

async function fetchInstanceDownloadUrl(instanceId: string, nonce: string | null): Promise<string | null> {
  const apiUrl = `https://makerworld.com/api/v1/design-service/instance/${instanceId}/f3mf?type=download&fileType=`;
  return extractDownloadUrl(await fetchMakerworldApiJson(apiUrl, nonce));
}

/** Same two steps as the backend: instance-scoped endpoint, then model-scoped. */
async function resolveFromPageApi(pageUrl: string): Promise<ResolvedDownload | null> {
  const page = readMakerworldDesignForPage(pageUrl);
  if (!page) return null; // the backend resolves from the URL
  const { design, nonce } = page;
  const instanceId = pickMakerworldInstanceId(design, page.requestedInstanceId);
  if (instanceId) {
    const downloadUrl = await fetchInstanceDownloadUrl(instanceId, nonce);
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
  const page = readMakerworldDesignForPage(pageUrl);
  if (!page) return null;
  const downloadUrl = await fetchInstanceDownloadUrl(instanceId, page.nonce).catch(() => null);
  return downloadUrl ? { downloadUrl, instanceId, design: makerworldDesignForImport(page.design) } : null;
}
