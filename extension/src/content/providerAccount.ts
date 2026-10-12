// Reads who the user is signed in as on Printables and Thingiverse, once per tab, and tells the
// background (see background/providerAccounts.ts). Only the signed-in account: these pages link to
// plenty of other people's profiles too.

import { request, send } from "../shared/messages";
import { sleep } from "./runtime";

// The header is drawn after load; give up quietly if it never shows (e.g. signed out).
const HEADER_WAIT_MS = 15_000;
const HEADER_POLL_MS = 500;

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

/** Asked of Printables' API as the site itself does; from this page, so its CORS rules allow it. */
async function readPrintablesHandle(): Promise<string | null> {
  const token = await request("GET_PRINTABLES_TOKEN").catch(() => null);
  if (!token) return null;
  try {
    const res = await fetch("https://api.printables.com/graphql/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: "query { me { handle } }" }),
    });
    const body = (await res.json()) as { data?: { me?: { handle?: unknown } | null } };
    const handle = body.data?.me?.handle;
    return typeof handle === "string" && handle ? handle : null;
  } catch {
    return null;
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
  void (provider === "printables" ? readPrintablesHandle() : readThingiverseUsername()).then((value) => {
    if (value) void send("REPORT_PROVIDER_ACCOUNT", { provider, value });
  });
}
