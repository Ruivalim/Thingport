// chrome.storage.local keys and the shape stored under them. Everything the extension persists
// lives in extension-local storage -- nothing is synced across browsers.

export const STORAGE_KEYS = {
  instanceUrl: "instanceUrl",
  email: "email",
  password: "password",
  disabled: "disabled",
  token: "token",
  tokenExpiresAt: "tokenExpiresAt",
  // The last MakerWorld `token` cookie value pushed to this account's Thingport-stored
  // makerworld_cookie -- lets the cookie sync skip a redundant PATCH when the live browser cookie
  // hasn't changed since. See background/makerworldCookie.ts.
  lastSyncedMakerworldCookie: "lastSyncedMakerworldCookie",
} as const;

export type StoredConfig = {
  instanceUrl?: string;
  email?: string;
  password?: string;
  disabled?: boolean;
  token?: string;
  tokenExpiresAt?: number;
  lastSyncedMakerworldCookie?: string;
};

/** Keys whose change means "re-evaluate whether/how this page shows the icon" -- see
 *  content/index.ts's storage listener. */
export const CONFIG_CHANGE_KEYS: readonly string[] = [
  STORAGE_KEYS.instanceUrl,
  STORAGE_KEYS.email,
  STORAGE_KEYS.password,
  STORAGE_KEYS.disabled,
];

/** Strips a trailing slash so `${instanceUrl}/api/...` never ends up with a doubled slash,
 *  regardless of whether the user typed one when saving the URL in the popup. */
export function normalizeInstanceUrl(raw: string | undefined | null): string {
  return (raw || "").trim().replace(/\/+$/, "");
}

export function apiUrl(instanceUrl: string, path: string): string {
  return `${normalizeInstanceUrl(instanceUrl)}/api${path}`;
}
