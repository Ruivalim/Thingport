// Batch flow for Thingiverse Likes/Collections and Printables Collections. MakerWorld collections
// use the guided flow in makerworldCollection.ts.

import type { BatchEntriesResult, ImportJob, SyncLookup } from "../../shared/api";
import { ctx } from "../context";
import { api, escapeHtml, sleep } from "../runtime";
import { isPanelMounted, onPanelAction, panelQueryAll, renderPanel } from "../shell";
import { errorHtml, statusHtml, successHtml } from "./results";
import { loadingModelsPhrases, renderFunStatus } from "./funStatus";
import { applySyncToggle, loadSyncState, readSyncToggle, syncChangeNote, syncToggleHtml } from "./syncToggle";
import { printablesToken, readCollectionForPanel } from "../printables";
import { pushPrintablesNow } from "../providerAccount";

type BatchKey = "thingiverse:likes" | "thingiverse:collection" | "printables:collection";

const BATCH_ENDPOINTS: Record<BatchKey, { entries: string; start: string; idField: string }> = {
  "thingiverse:likes": {
    entries: "/import/thingiverse-likes/entries",
    start: "/import/thingiverse-likes",
    idField: "thing_ids",
  },
  "thingiverse:collection": {
    entries: "/import/thingiverse-collection/entries",
    start: "/import/thingiverse-collection",
    idField: "thing_ids",
  },
  "printables:collection": {
    entries: "/import/printables-collection/entries",
    start: "/import/printables-collection",
    idField: "model_ids",
  },
};

function endpoints() {
  const { provider, type } = ctx().classification;
  const config = BATCH_ENDPOINTS[`${provider}:${type}` as BatchKey];
  if (!config) throw new Error(`Batch import isn't supported for ${provider} ${type}`);
  return config;
}

function isPrintablesCollection(): boolean {
  const { provider, type } = ctx().classification;
  return provider === "printables" && type === "collection";
}

function printablesCollectionId(): string | null {
  return ctx().url.match(/\/collections\/(\d+)/)?.[1] ?? null;
}

/** A Printables collection as its signed-in owner sees it: the instance can only read public ones,
 *  and would find a private one empty. Null without a login, for the instance's own read; a failed
 *  read with one says so, rather than falling back to that read and looking empty. */
async function signedInPrintablesEntries(): Promise<BatchEntriesResult | null> {
  const collectionId = printablesCollectionId();
  const token = collectionId ? await printablesToken() : null;
  if (!collectionId || !token) return null;
  try {
    const { title, entries, truncated } = await readCollectionForPanel(token, collectionId);
    const { print_ids: inLibrary } = await api<{ print_ids: Record<string, string> }>("POST", "/import/status/batch", {
      provider: "printables",
      external_ids: entries.map((entry) => entry.id),
    });
    return {
      title,
      truncated,
      entries: entries.map((entry) => ({
        design_id: entry.id,
        title: entry.title,
        already_imported: entry.id in inLibrary,
      })),
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Couldn't read this collection from Printables as you: ${reason}. Reload the page to try again.`, {
      cause: err,
    });
  }
}

/** `readAsUser`: read with the user's Printables login, as only a private collection needs. */
type PanelEntries = BatchEntriesResult & { readAsUser?: boolean };

/** The instance's own read first; for a Printables collection it finds nothing in (a private one),
 *  the user's own. */
async function loadEntries(): Promise<PanelEntries> {
  let instanceError: unknown = null;
  try {
    const found = await api<BatchEntriesResult>("POST", endpoints().entries, { url: ctx().url });
    if (found.entries.length || !isPrintablesCollection()) return found;
  } catch (err) {
    if (!isPrintablesCollection()) throw err;
    instanceError = err;
  }
  // Null without a login; a read with one, even an empty one, is the answer.
  const signedIn = await signedInPrintablesEntries();
  if (signedIn) return { ...signedIn, readAsUser: true };
  if (instanceError) throw instanceError;
  return { entries: [] };
}

export async function loadBatchEntries(): Promise<void> {
  renderFunStatus(loadingModelsPhrases(ctx().classification.provider));
  let result: PanelEntries;
  let sync: SyncLookup | null;
  try {
    [result, sync] = await Promise.all([loadEntries(), loadSyncState()]);
  } catch (err) {
    renderPanel(errorHtml(err));
    return;
  }
  const allImported = result.entries.every((entry) => entry.already_imported);
  const rows = result.entries
    .map(
      (entry) => `
        <label class="tg-entry${entry.already_imported ? " tg-entry--imported" : ""}">
          <input type="checkbox" class="tg-entry__checkbox" value="${escapeHtml(entry.design_id)}" ${entry.already_imported ? "" : "checked"} />
          <span class="tg-entry__name">${escapeHtml(entry.title || entry.design_id)}</span>
          ${entry.already_imported ? '<span class="tg-badge">already imported</span>' : ""}
        </label>
      `,
    )
    .join("");
  const found = `${result.entries.length} models found${result.truncated ? " (more available on the site)" : ""}`;
  renderPanel(`
    <div class="tg-title">${escapeHtml(result.title || "Import models")}</div>
    <div class="tg-hint">${allImported && result.entries.length ? `${found}, all already in your library.` : found}</div>
    <div class="tg-entries">${rows}</div>
    ${syncToggleHtml(sync)}
    <button class="tg-btn" type="button" data-action="import">${allImported && sync ? "Save" : "Import selected"}</button>
  `);
  onPanelAction("import", () => void runBatchImport(result, sync));
}

async function runBatchImport(result: PanelEntries, sync: SyncLookup | null): Promise<void> {
  const ids = panelQueryAll<HTMLInputElement>(".tg-entry__checkbox:checked").map((el) => el.value);
  const wantSync = readSyncToggle();
  if (!ids.length && !sync) return;
  const { url, instanceUrl } = ctx();
  const { start, idField } = endpoints();
  renderPanel(statusHtml(ids.length ? "Starting import…" : "Saving…"));
  try {
    // Sync first, so the import files into the synced collection.
    const { change, link } = await applySyncToggle(sync, wantSync, {
      title: result.title ?? null,
      knownIds: result.entries.map((entry) => entry.design_id),
    });
    const note = syncChangeNote(change, link);
    // A private one: the instance can't read it, so it gets its models now rather than waiting.
    const collectionId = result.readAsUser ? printablesCollectionId() : null;
    if (change === "enabled" && collectionId) {
      void pushPrintablesNow(
        collectionId,
        result.entries.map((entry) => entry.design_id),
      );
    }
    if (!ids.length) {
      const target = link ?? sync?.sync;
      const collectionLink = target
        ? `${instanceUrl}/models/collections/${target.collection_id}`
        : `${instanceUrl}/models`;
      renderPanel(successHtml(collectionLink, note ?? "Nothing new to import.", note ? "Saved" : "Nothing to import"));
      return;
    }
    const { job_id } = await api<{ job_id: string }>("POST", start, {
      url,
      [idField]: ids,
      // A private Printables collection's name, which the instance can't read itself.
      ...(result.readAsUser ? { collection_title: result.title ?? null } : {}),
    });
    await pollJobWithProgress(job_id, instanceUrl, note);
  } catch (err) {
    renderPanel(errorHtml(err));
  }
}

async function pollJobWithProgress(jobId: string, instanceUrl: string, note: string | null = null): Promise<void> {
  for (;;) {
    // The panel is gone; the job keeps running server-side.
    if (!isPanelMounted()) return;
    const job = await api<ImportJob>("GET", `/import/jobs/${jobId}`);
    if (!isPanelMounted()) return;
    if (job.status === "RUNNING") {
      renderPanel(statusHtml(`Importing ${job.processed} of ${job.total}…`));
      await sleep(1000);
      continue;
    }
    if (job.status === "ERROR") {
      renderPanel(errorHtml(new Error(job.error_message || "Import failed")));
      return;
    }
    const link = job.result_print_id ? `${instanceUrl}/models/${job.result_print_id}` : `${instanceUrl}/models`;
    renderPanel(successHtml(link, `Imported ${job.imported} of ${job.total}.${note ? ` ${note}` : ""}`));
    return;
  }
}
