// chrome.storage.local keys and their shapes. Nothing is synced across browsers.

export const STORAGE_KEYS = {
  instanceUrl: "instanceUrl",
  email: "email",
  password: "password",
  disabled: "disabled",
  // From the last login: admins get "Add to the queue" in the import panel.
  isAdmin: "isAdmin",
  token: "token",
  tokenExpiresAt: "tokenExpiresAt",
  // Last successful sign-in; the connection check signs in again once it's a few minutes old.
  loginVerifiedAt: "loginVerifiedAt",
  // Lets the cookie sync skip a redundant PATCH.
  lastSyncedMakerworldCookie: "lastSyncedMakerworldCookie",
  // The Printables and Thingiverse usernames last sent to the instance, so unchanged ones aren't.
  lastSentProviderAccounts: "lastSentProviderAccounts",
  // When Printables' lists were last read and sent, so a burst of page loads reads them once.
  lastPrintablesPushAt: "lastPrintablesPushAt",
  // When every page of the user's Printables likes was last read (see printablesPushDue).
  lastPrintablesLikesAt: "lastPrintablesLikesAt",
  // When a tab was last told to read Printables, so others hold off meanwhile.
  printablesPlanHandedOutAt: "printablesPlanHandedOutAt",
} as const;

export type StoredConfig = {
  instanceUrl?: string;
  email?: string;
  password?: string;
  disabled?: boolean;
  isAdmin?: boolean;
  token?: string;
  tokenExpiresAt?: number;
  loginVerifiedAt?: number;
  lastSyncedMakerworldCookie?: string;
  /** `account` is the Thingport instance and email they were sent to. */
  lastSentProviderAccounts?: { account: string; values: Record<string, string> };
  lastPrintablesPushAt?: number;
  lastPrintablesLikesAt?: number;
  printablesPlanHandedOutAt?: number;
};

export const CONFIG_CHANGE_KEYS: readonly string[] = [
  STORAGE_KEYS.instanceUrl,
  STORAGE_KEYS.email,
  STORAGE_KEYS.password,
  STORAGE_KEYS.disabled,
  STORAGE_KEYS.isAdmin,
];

export function normalizeInstanceUrl(raw: string | undefined | null): string {
  return (raw || "").trim().replace(/\/+$/, "");
}

export function apiUrl(instanceUrl: string, path: string): string {
  return `${normalizeInstanceUrl(instanceUrl)}/api${path}`;
}
