// Who the user is signed in as on Printables and Thingiverse, read on their pages, so the web app's
// Browse tab lists their collections without asking. Sent only when it changes; the signed-in
// account replaces a username typed into the app.

import type { AccountProvider } from "../shared/messages";
import { apiCall, requireConfig } from "./api";

/** HttpOnly, so the page can't read it but chrome.cookies can. Null (never throws) when signed out. */
export async function getPrintablesToken(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({ url: "https://www.printables.com", name: "auth.access_token" });
    return cookie?.value || null;
  } catch {
    return null;
  }
}

/** Best-effort: an instance without the endpoint, or without Thingiverse connected, just says no. */
export async function reportProviderAccount(provider: AccountProvider, value: string): Promise<null> {
  const config = await requireConfig().catch(() => null);
  if (!config) return null;
  // Per Thingport account, so switching the extension to another one sends it there too.
  const account = `${config.instanceUrl} ${config.email}`;
  const sent = config.lastSentProviderAccounts?.account === account ? config.lastSentProviderAccounts.values : {};
  if (sent[provider] === value) return null;
  try {
    await apiCall("PUT", `/provider-collections/accounts/${provider}`, { value });
    await chrome.storage.local.set({ lastSentProviderAccounts: { account, values: { ...sent, [provider]: value } } });
  } catch {}
  return null;
}
