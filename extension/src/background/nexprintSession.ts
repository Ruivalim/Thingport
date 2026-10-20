// The user's NexPrint sign-in, which downloads its files: the auth_token cookie, sent as a Bearer token. The site keeps
// it for a week and sets it again whenever it refreshes the token, so Grab sends each new one on, with the cookie's
// expiry for the app to show.

import { STORAGE_KEYS } from "../shared/storage";
import { apiCall, requireConfig } from "./api";

const SITE = "https://www.nexprint.com";

/** Sends the instance the browser's NexPrint sign-in when it changed. Best-effort: never throws. */
export async function syncNexprintSession(): Promise<void> {
  const config = await requireConfig().catch(() => null);
  if (!config) return;
  let cookie: chrome.cookies.Cookie | null;
  try {
    cookie = await chrome.cookies.get({ url: SITE, name: "auth_token" });
  } catch {
    return;
  }
  // Per Thingport account, so switching the extension to another one sends it there too.
  const account = `${config.instanceUrl} ${config.email}`;
  const last = config.lastSyncedNexprintSession;
  let token = "";
  try {
    token = cookie?.value ? decodeURIComponent(cookie.value) : "";
  } catch {} // Malformed percent-encoding: not a token.
  // Signed out, the site clears the cookie or leaves a placeholder in it.
  if (!/^[0-9a-f]{32,128}$/i.test(token)) {
    // Clear the sign-in Grab sent, but not one pasted in Thingport.
    if (last?.account === account) {
      try {
        await apiCall("PATCH", "/settings/nexprint-session", { token: null });
        await chrome.storage.local.remove(STORAGE_KEYS.lastSyncedNexprintSession);
      } catch {}
    }
    return;
  }
  if (last?.account === account && last.value === token) return;
  try {
    await apiCall("PATCH", "/settings/nexprint-session", {
      token,
      expires_at: cookie?.expirationDate ? new Date(cookie.expirationDate * 1000).toISOString() : null,
    });
    await chrome.storage.local.set({ [STORAGE_KEYS.lastSyncedNexprintSession]: { account, value: token } });
  } catch {}
}
