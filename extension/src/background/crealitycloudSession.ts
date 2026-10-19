// The user's Creality Cloud sign-in, which downloads its files and reads the user's likes: the model_token and
// model_user_id cookies, which its API takes together. The site sets them once at sign-in for a week and never renews
// them, so Grab only sends each new pair on, with the cookie's expiry for the app to show.

import { STORAGE_KEYS } from "../shared/storage";
import { apiCall, requireConfig } from "./api";

const SITE = "https://www.crealitycloud.com";

/** Sends the instance the browser's Creality Cloud sign-in when it changed. Best-effort: never throws. Says who's
 *  signed in there. */
export async function syncCrealitycloudSession(): Promise<{ userId: string | null }> {
  const config = await requireConfig().catch(() => null);
  if (!config) return { userId: null };
  let token: chrome.cookies.Cookie | null;
  let user: chrome.cookies.Cookie | null;
  try {
    [token, user] = await Promise.all([
      chrome.cookies.get({ url: SITE, name: "model_token" }),
      chrome.cookies.get({ url: SITE, name: "model_user_id" }),
    ]);
  } catch {
    return { userId: null };
  }
  if (!token?.value || !user?.value) return { userId: null };
  const value = `model_token=${token.value}; model_user_id=${user.value}`;
  // Per Thingport account, so switching the extension to another one sends it there too.
  const account = `${config.instanceUrl} ${config.email}`;
  const last = config.lastSyncedCrealitycloudSession;
  if (last?.account !== account || last.value !== value) {
    try {
      await apiCall("PATCH", "/settings/crealitycloud-session", {
        token: value,
        expires_at: token.expirationDate ? new Date(token.expirationDate * 1000).toISOString() : null,
      });
      await chrome.storage.local.set({ [STORAGE_KEYS.lastSyncedCrealitycloudSession]: { account, value } });
    } catch {}
  }
  return { userId: decodeURIComponent(user.value) };
}
