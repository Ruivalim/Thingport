// MakerWorld guided collection import. MakerWorld (unlike the other providers) trips a multi-hour
// account-wide CAPTCHA lockout from a burst of collection-import API calls, even with pacing -- see
// background/makerworldJob.ts. This avoids MakerWorld's collection-listing API entirely: every
// model id is scraped from the page's own DOM after scrolling it to the end -- the same requests
// MakerWorld's site already makes for a person scrolling by hand. No entry-selection step (unlike
// the batch flow) -- every not-yet-imported model is queued.

import type { Collection, ImportStatus } from "../../shared/api";
import { request } from "../../shared/messages";
import { makerworldModelUrl } from "../../shared/urls";
import { ctx } from "../context";
import { mountScanOverlay } from "../overlays";
import { api, escapeHtml, sleep } from "../runtime";
import { getShadowRoot, onPanelAction, renderPanel } from "../shell";
import { errorHtml, statusHtml, successHtml } from "./results";

// Wait before the first scroll/check: the page can still be mid-hydration (most often right after
// navigating back from a finished guided run), and checking too early can see zero cards, which the
// stagnant-round check below would mistake for "already at the end".
const SCAN_START_DELAY_MS = 1500;
const SCAN_ROUND_DELAY_MS = 700;
const SCAN_MAX_ROUNDS = 300; // generous: 153 models at ~20/page is ~8 loads
const SCAN_STAGNANT_LIMIT = 6;

/** True once MakerWorld's own "No more data" end-of-list marker shows -- matched on rendered text,
 *  not a class name (MakerWorld's CSS-module classes are build hashes that change on redeploy). */
function hasNoMoreDataMarker(): boolean {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent && node.textContent.trim() === "No more data") return true;
  }
  return false;
}

/** Every distinct design id linked from the DOM -- a card links to "/en/models/1954043-...". */
function extractModelIds(): string[] {
  const ids = new Set<string>();
  for (const a of document.querySelectorAll('a[href*="/models/"]')) {
    const match = (a.getAttribute("href") || "").match(/\/models\/(\d+)/);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

/** Repeatedly scrolls the last loaded card into view -- the standard nudge for an
 *  intersection-observer infinite scroll, and more reliable than scrolling the window when the real
 *  scroll container is some nested element. Stops on the "No more data" marker, or once the count
 *  stops growing for several rounds (a safety net if that wording changes); never loops forever. */
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

/** This user's Thingport collection matching the MakerWorld collection's title (case-insensitive,
 *  like the backend's uniqueness check), created if missing. Null on any failure -- the import
 *  still proceeds, it just has nowhere to file into. */
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

  // Already-imported models are filed here, synchronously, rather than by the background job --
  // they need no page visit, so there's nothing to pace.
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
  // The tab is about to navigate to the first model's page; the job overlay takes over from there.
}
