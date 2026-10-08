// Batch flow for Thingiverse Likes/Collections and Printables Collections. MakerWorld collections
// use the guided flow in makerworldCollection.ts.

import type { BatchEntriesResult, ImportJob, SyncLookup } from "../../shared/api";
import { ctx } from "../context";
import { api, escapeHtml, sleep } from "../runtime";
import { isPanelMounted, onPanelAction, panelQueryAll, renderPanel } from "../shell";
import { errorHtml, statusHtml, successHtml } from "./results";
import { loadingModelsPhrases, renderFunStatus } from "./funStatus";
import { applySyncToggle, loadSyncState, readSyncToggle, syncChangeNote, syncToggleHtml } from "./syncToggle";

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

export async function loadBatchEntries(): Promise<void> {
  renderFunStatus(loadingModelsPhrases(ctx().classification.provider));
  let result: BatchEntriesResult;
  let sync: SyncLookup | null;
  try {
    [result, sync] = await Promise.all([
      api<BatchEntriesResult>("POST", endpoints().entries, { url: ctx().url }),
      loadSyncState(),
    ]);
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

async function runBatchImport(result: BatchEntriesResult, sync: SyncLookup | null): Promise<void> {
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
    if (!ids.length) {
      const target = link ?? sync?.sync;
      const collectionLink = target
        ? `${instanceUrl}/models/collections/${target.collection_id}`
        : `${instanceUrl}/models`;
      renderPanel(successHtml(collectionLink, note ?? "Nothing new to import.", note ? "Saved" : "Nothing to import"));
      return;
    }
    const { job_id } = await api<{ job_id: string }>("POST", start, { url, [idField]: ids });
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
