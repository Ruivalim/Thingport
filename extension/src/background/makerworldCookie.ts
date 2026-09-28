import type { ConfiguredConfig } from "./config";
import { apiCall } from "./api";

/** The session cookie is HttpOnly, so pages can't read it but chrome.cookies can. Null (never
 *  throws) when the user isn't logged in or access is blocked. */
export async function getLiveMakerworldCookie(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({ url: "https://makerworld.com", name: "token" });
    if (!cookie) return null;
    // "token=<value>": a bare token containing `=` (base64 padding) would be rejected by the backend.
    return `token=${cookie.value}`;
  } catch {
    return null;
  }
}

/** Best-effort: keeps the stored cookie in sync so the web app's imports benefit too. Never
 *  affects the triggering import. */
export async function maybeSyncMakerworldCookie(config: ConfiguredConfig, cookieValue: string): Promise<void> {
  if (config.lastSyncedMakerworldCookie === cookieValue) return;
  try {
    await apiCall("PATCH", "/settings/makerworld", { cookie: cookieValue });
    await chrome.storage.local.set({ lastSyncedMakerworldCookie: cookieValue });
  } catch {
  }
}
