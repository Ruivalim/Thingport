import type { ConfiguredConfig } from "./config";
import { apiCall } from "./api";

/** Reads the user's live MakerWorld session straight from the browser's cookie jar -- makerworld.com
 *  sets it HttpOnly, which blocks a page's own `document.cookie` (that's the whole reason the web
 *  app's Profile settings flow has the user paste it in manually), but chrome.cookies is a
 *  privileged, extension-only API allowed to read HttpOnly cookies. Requires the "cookies"
 *  permission plus host access to makerworld.com (from the static content_scripts match). Returns
 *  null (never throws) if the user isn't logged into MakerWorld in this browser, or cookie access
 *  is blocked -- callers fall back to whatever's already stored in Thingport. */
export async function getLiveMakerworldCookie(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({ url: "https://makerworld.com", name: "token" });
    if (!cookie) return null;
    // Re-wrapped as "token=<value>" rather than the bare value -- the backend's
    // extractMakerworldBearerToken (makerworldCloudApi.ts) has a "token=...;" regex path and a
    // bare-token fallback that rejects any `=`, `;` or whitespace. A real session token can
    // contain `=` (base64 padding), and a cookie value can never contain an unquoted `;`, so this
    // format always takes the first, unambiguous path.
    return `token=${cookie.value}`;
  } catch {
    return null;
  }
}

/** Best-effort: keeps Thingport's own stored makerworld_cookie (Profile > MakerWorld) in sync with
 *  whatever's live in the browser, so the plain web app's imports benefit too. Skipped once it's
 *  already in sync, and never lets a failure affect the import that triggered it -- callers fire
 *  this and move on. */
export async function maybeSyncMakerworldCookie(config: ConfiguredConfig, cookieValue: string): Promise<void> {
  if (config.lastSyncedMakerworldCookie === cookieValue) return;
  try {
    await apiCall("PATCH", "/settings/makerworld", { cookie: cookieValue });
    await chrome.storage.local.set({ lastSyncedMakerworldCookie: cookieValue });
  } catch {
    // Best-effort -- the import this was piggybacking on already has the live cookie regardless.
  }
}
