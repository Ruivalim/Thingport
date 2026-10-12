// Reads who the user is signed in as on Printables and Thingiverse, once per tab, and tells the
// background (see background/providerAccounts.ts). Only the signed-in account: these pages link to
// plenty of other people's profiles too.

import { request, send } from "../shared/messages";
import { printablesToken, readMe, readPrintables } from "./printables";
import { sleep } from "./runtime";

// The header is drawn after load; give up quietly if it never shows (e.g. signed out).
const HEADER_WAIT_MS = 15_000;
const HEADER_POLL_MS = 500;
const TOKEN_WAIT_MS = 30_000;
const TOKEN_POLL_MS = 2_000;

let captured = false;

/** Thingiverse's header avatar links to the signed-in user's designs: /<username>/designs. */
async function readThingiverseUsername(): Promise<string | null> {
  for (let waited = 0; waited < HEADER_WAIT_MS; waited += HEADER_POLL_MS) {
    const link = document.querySelector<HTMLAnchorElement>('[class*="PageHeader__pageHeader"] a[href$="/designs"]');
    const username = link?.getAttribute("href")?.split("/").find(Boolean);
    if (username) return decodeURIComponent(username);
    await sleep(HEADER_POLL_MS);
  }
  return null;
}

/** Reads and sends what only the user sees on Printables, when it's time (or `now`). */
async function pushPrintables(
  token: string,
  me: { id: string; handle: string },
  { now = false, listings = {} }: { now?: boolean; listings?: Record<string, string[]> } = {},
): Promise<void> {
  try {
    const plan = await request("PRINTABLES_PUSH_DUE", { now });
    if (!plan) return;
    const push = await readPrintables(token, me, plan);
    await request("PUSH_PRINTABLES", { ...push, listings: { ...push.listings, ...listings } });
  } catch {}
}

/** Right away, with the models of a collection whose sync was just turned on on its page: the
 *  instance can't have asked for them yet, and would otherwise wait for the next visit to read it. */
export async function pushPrintablesNow(collectionId: string, modelIds: string[]): Promise<void> {
  const token = await printablesToken();
  const me = token ? await readMe(token).catch(() => null) : null;
  if (token && me) await pushPrintables(token, me, { now: true, listings: { [collectionId]: modelIds } });
}

/** At most hourly, what only the signed-in user sees on Printables: private collections and likes,
 *  for syncing them (see printables.ts). The push names the account too: reported on its own, it
 *  would link an account the user forgot in the app again. */
async function syncPrintables(): Promise<void> {
  // The token lasts minutes; the site renews an expired one only after it loads, so keep asking.
  for (let waited = 0; waited < TOKEN_WAIT_MS; waited += TOKEN_POLL_MS) {
    const token = await printablesToken();
    const me = token ? await readMe(token).catch(() => null) : null;
    if (token && me) return pushPrintables(token, me);
    await sleep(TOKEN_POLL_MS);
  }
}

export function captureProviderAccount(hostname: string): void {
  if (captured) return;
  const provider = hostname.endsWith("printables.com")
    ? "printables"
    : hostname.endsWith("thingiverse.com")
      ? "thingiverse"
      : null;
  if (!provider) return;
  captured = true;
  if (provider === "printables") {
    void syncPrintables();
    return;
  }
  void readThingiverseUsername().then((value) => {
    if (value) void send("REPORT_PROVIDER_ACCOUNT", { provider, value });
  });
}
