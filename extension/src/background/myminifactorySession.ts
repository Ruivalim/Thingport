// The user's MyMiniFactory session, which downloads the paid and login-only models in their library. The cookie is
// HttpOnly, so only the background can read it; it's sent to the instance whenever it changes, so imports, the web
// app's included, keep working as MyMiniFactory renews it.

import { STORAGE_KEYS } from "../shared/storage";
import { apiCall, requireConfig } from "./api";

/** Best-effort: never throws, and an instance without the endpoint just doesn't take it. */
export async function syncMyminifactorySession(): Promise<null> {
  const config = await requireConfig().catch(() => null);
  if (!config) return null;
  let session: chrome.cookies.Cookie | null;
  try {
    session = await chrome.cookies.get({ url: "https://www.myminifactory.com", name: "PHPSESSID" });
  } catch {
    return null;
  }
  if (!session?.value) return null;
  const value = `PHPSESSID=${session.value}`;
  // Per Thingport account, so switching the extension to another one sends it there too.
  const account = `${config.instanceUrl} ${config.email}`;
  const last = config.lastSyncedMyminifactorySession;
  if (last?.account === account && last.value === value) return null;
  try {
    await apiCall("PATCH", "/settings/myminifactory-session", { cookie: value });
    await chrome.storage.local.set({ [STORAGE_KEYS.lastSyncedMyminifactorySession]: { account, value } });
  } catch {}
  return null;
}
