// The browser's Cults3D sign-in, which opens the site's order and download pages: the _session_id cookie, and the
// cf_clearance cookie Cloudflare gave this browser, with the User-Agent it gave it to. Thingport's server sends them
// as this browser would; the clearance only holds from this browser's IP address. Sent on when they change.

import { STORAGE_KEYS } from "../shared/storage";
import { apiCall, requireConfig } from "./api";

const SITE = "https://cults3d.com";

async function cookieValue(name: string): Promise<string> {
  try {
    const plain = (await chrome.cookies.get({ url: SITE, name }))?.value;
    if (plain) return plain;
    // Cloudflare sets cf_clearance partitioned (CHIPS), keyed to the site itself; a plain lookup doesn't see those, and
    // an exact partition key would have to match its cross-site flag too. An empty one lists every partition's.
    const partitioned = await chrome.cookies.getAll({ domain: "cults3d.com", name, partitionKey: {} });
    const own = partitioned.find((cookie) =>
      /^https:\/\/(www\.)?cults3d\.com$/i.test(cookie.partitionKey?.topLevelSite ?? ""),
    );
    return (own ?? partitioned[0])?.value ?? "";
  } catch {
    return "";
  }
}

/** Sends the instance the browser's Cults3D sign-in when it changed. Best-effort: never throws. */
export async function syncCults3dSession(): Promise<void> {
  const config = await requireConfig().catch(() => null);
  if (!config) return;
  const [session, clearance] = await Promise.all([cookieValue("_session_id"), cookieValue("cf_clearance")]);
  // Per Thingport account, so switching the extension to another one sends it there too.
  const account = `${config.instanceUrl} ${config.email}`;
  const last = config.lastSyncedCults3dSession;
  if (!session) {
    // Signed out there: clear the sign-in Grab sent, but not one pasted in Thingport.
    if (last?.account === account) {
      try {
        await apiCall("PATCH", "/settings/cults3d-session", { session: null });
        await chrome.storage.local.remove(STORAGE_KEYS.lastSyncedCults3dSession);
      } catch {}
    }
    return;
  }
  // Only asked for from a signed-in page (see content/cults3d.ts): visitors get a session cookie too.
  const cookie = `_session_id=${session}${clearance ? `; cf_clearance=${clearance}` : ""}`;
  const value = `${cookie} ${navigator.userAgent}`;
  if (last?.account === account && last.value === value) return;
  try {
    await apiCall("PATCH", "/settings/cults3d-session", { session: cookie, user_agent: navigator.userAgent });
    await chrome.storage.local.set({ [STORAGE_KEYS.lastSyncedCults3dSession]: { account, value } });
  } catch {}
}
