// MakerWorld collection import. Avoids MakerWorld's collection-listing API (a burst of those calls
// trips an account-wide CAPTCHA) by scrolling the page and scraping model ids from the DOM.
// Every not-yet-imported model is queued.

import type { Collection, ImportStatus } from "../../shared/api";
import { request } from "../../shared/messages";
import { makerworldModelUrl } from "../../shared/urls";
import { ctx } from "../context";
import { mountScanOverlay } from "../overlays";
import { api, escapeHtml, sleep } from "../runtime";
import { getShadowRoot, onPanelAction, renderPanel } from "../shell";
import { errorHtml, statusHtml, successHtml } from "./results";

// The page may still be hydrating; checking too early sees zero cards and looks like the end.
const SCAN_START_DELAY_MS = 1500;
const SCAN_ROUND_DELAY_MS = 700;
const SCAN_MAX_ROUNDS = 300; // generous: 153 models at ~20/page is ~8 loads
const SCAN_STAGNANT_LIMIT = 6;

/** Matched on text: MakerWorld's class names are build hashes. */
function hasNoMoreDataMarker(): boolean {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent && node.textContent.trim() === "No more data") return true;
  }
  return false;
}

function extractModelIds(): string[] {
  const ids = new Set<string>();
  for (const a of document.querySelectorAll('a[href*="/models/"]')) {
    const match = (a.getAttribute("href") || "").match(/\/models\/(\d+)/);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

/** Scrolls the last card into view until the end marker shows or the count stops growing. */
async function scrollToEnd(onProgress: (count: number) => void): Promise<void> {
  let lastCount = -1;
  let stagnantRounds = 0;
  await sleep(SCAN_START_DELAY_MS);
  for (let round = 0; round < SCAN_MAX_ROUNDS; round++) {
    if (hasNoMoreDataMarker()) return;
    const links = document.querySelectorAll('a[href*="/models/"]');
    const lastLink = links[links.length - 1];
    if (lastLink) lastLink.scrollIntoView({ block: "end" });
    else window.scrollTo(0, document.body.scrollHeight);
    await sleep(SCAN_ROUND_DELAY_MS);
    const count = extractModelIds().length;
    onProgress(count);
    stagnantRounds = count === lastCount ? stagnantRounds + 1 : 0;
    if (stagnantRounds >= SCAN_STAGNANT_LIMIT) return;
    lastCount = count;
  }
}

/** Case-insensitive match on title, created if missing. Null on failure; the import proceeds. */
async function findOrCreateCollection(name: string | null): Promise<string | null> {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  try {
    const collections = await api<Collection[]>("GET", "/collections");
    const existing = collections.find((c) => !c.system_key && (c.name || "").trim().toLowerCase() === normalized);
    if (existing) return existing.id;
    return (await api<Collection>("POST", "/collections", { name: trimmed })).id;
  } catch {
    return null;
  }
}

type ModelStatus = { url: string; already_imported: boolean; print_id: string | null };

export async function loadMakerworldGuidedCollection(): Promise<void> {
  const collectionTitle = document.getElementsByTagName("h1")[0]?.innerText?.trim() || null;

  const root = getShadowRoot();
  if (!root) return;
  const scan = mountScanOverlay(root);
  await scrollToEnd((count) => scan.update(count));
  scan.remove();

  const ids = extractModelIds();
  if (!ids.length) {
    renderPanel(errorHtml(new Error("Couldn't find any models on this page -- MakerWorld may have changed its page layout.")));
    return;
  }

  renderPanel(statusHtml(`Checking ${ids.length} models against your library…`));
  const statuses: ModelStatus[] = await Promise.all(
    ids.map(async (id) => {
      const url = makerworldModelUrl(id);
      try {
        const status = await api<ImportStatus>("GET", `/import/status?url=${encodeURIComponent(url)}`);
        return { url, already_imported: status.already_imported, print_id: status.print_id ?? null };
      } catch {
        return { url, already_imported: false, print_id: null };
      }
    }),
  );
  const toImport = statuses.filter((s) => !s.already_imported);
  const alreadyImported = statuses.filter((s) => s.already_imported);

  const parts: string[] = [];
  if (toImport.length) parts.push(`${toImport.length} new model${toImport.length === 1 ? "" : "s"} to import`);
  if (alreadyImported.length) parts.push(`${alreadyImported.length} already in your library`);
  renderPanel(`
    <div class="tg-title">${escapeHtml(collectionTitle || "Import collection")}</div>
    <div class="tg-hint">${parts.join(", ") || "No models found."}</div>
    <button class="tg-btn" type="button" data-action="start">Start import</button>
    <div class="tg-hint tg-hint--spaced">
      ${collectionTitle ? `Models go into a Thingport collection named "${escapeHtml(collectionTitle)}" (created if it doesn't exist yet). ` : ""}New
      models are imported one page visit at a time, pacing itself to avoid MakerWorld's rate
      limiting -- this can take a while for a large collection.
    </div>
  `);
  onPanelAction("start", () => void startGuidedImport(toImport, alreadyImported, collectionTitle));
}

async function startGuidedImport(toImport: ModelStatus[], alreadyImported: ModelStatus[], collectionTitle: string | null): Promise<void> {
  const { url: originalUrl, instanceUrl } = ctx();
  renderPanel(statusHtml("Preparing your collection…"));
  const collectionId = await findOrCreateCollection(collectionTitle);

  // Already-imported models need no page visit, so they're filed here directly.
  if (alreadyImported.length && collectionId) {
    renderPanel(statusHtml(`Adding ${alreadyImported.length} existing model${alreadyImported.length === 1 ? "" : "s"} to your collection…`));
    for (const entry of alreadyImported) {
      if (entry.print_id) await api("POST", `/collection/${collectionId}/items/${entry.print_id}`).catch(() => undefined);
    }
  }

  if (!toImport.length) {
    renderPanel(successHtml(`${instanceUrl}/models`, "Nothing new to import -- already-imported models were added to your collection."));
    return;
  }

  renderPanel(statusHtml("Starting guided import…"));
  await request("START_MAKERWORLD_COLLECTION_JOB", { urls: toImport.map((e) => e.url), collectionId, originalUrl });
}
