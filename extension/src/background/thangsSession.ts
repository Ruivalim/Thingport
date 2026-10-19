// The user's Thangs sign-in, which downloads its files: the accessToken cookie (a week-long token, sent as a Bearer
// token) and the refreshToken cookie that renews it. Thingport renews the access token itself, so Grab only sends them
// on when the browser's change: a sign-in, or the site renewing its own.

import { STORAGE_KEYS } from "../shared/storage";
import { apiCall, requireConfig } from "./api";

const SITE = "https://thangs.com";
const JWT = /^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+$/;

/** The cookie's token, "" when there is none, or undefined when it couldn't be read. */
async function cookieValue(name: string): Promise<string | undefined> {
  try {
    const cookie = await chrome.cookies.get({ url: SITE, name });
    const value = cookie?.value ? decodeURIComponent(cookie.value) : "";
    return JWT.test(value) ? value : "";
  } catch {
    return undefined; // Unreadable, or malformed percent-encoding: no reason to think the user signed out.
  }
}

/** Sends the instance the browser's Thangs sign-in when it changed. Best-effort: never throws. */
export async function syncThangsSession(): Promise<void> {
  const config = await requireConfig().catch(() => null);
  if (!config) return;
  const [token, refreshToken] = await Promise.all([cookieValue("accessToken"), cookieValue("refreshToken")]);
  if (token === undefined || refreshToken === undefined) return;
  // Per Thingport account, so switching the extension to another one sends it there too.
  const account = `${config.instanceUrl} ${config.email}`;
  const last = config.lastSyncedThangsSession;
  if (!token && !refreshToken) {
    // Signed out there: clear the sign-in Grab sent, but not one pasted in Thingport.
    if (last?.account === account) {
      try {
        await apiCall("PATCH", "/settings/thangs-session", { token: null });
        await chrome.storage.local.remove(STORAGE_KEYS.lastSyncedThangsSession);
      } catch {}
    }
    return;
  }
  const value = `${token} ${refreshToken}`;
  if (last?.account === account && last.value === value) return;
  try {
    await apiCall("PATCH", "/settings/thangs-session", { token: token || null, refresh_token: refreshToken || null });
    await chrome.storage.local.set({ [STORAGE_KEYS.lastSyncedThangsSession]: { account, value } });
  } catch {}
}
