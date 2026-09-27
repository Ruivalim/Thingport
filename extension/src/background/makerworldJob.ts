// MakerWorld guided collection import.
//
// MakerWorld's anti-abuse system CAPTCHAs the whole account for hours the moment a burst of
// collection-import API calls looks automated -- even with pacing, a large collection can trip it
// almost immediately (see the backend's IMPORT_MAKERWORLD_CALL_DELAY_MS comment). Rather than
// firing every design's import calls back-to-back from the backend, this drives the tab to each
// model's own page, one at a time -- a real navigation + page load imposes pacing no config value
// can fake, and looks like a person browsing rather than a script. Each page load is a plain
// single-model import (importSingle), the same path a manual visit uses.
//
// State lives in chrome.storage (not a module variable) because the job outlives any single page
// load in the tab it's driving, and an MV3 background can be suspended and woken again between
// steps -- tabs.onUpdated firing later is what wakes it, at which point it re-reads this.

import type { ImportStatus } from "../shared/api";
import type { MakerworldJob, MakerworldJobError } from "../shared/messages";
import { sendToTab } from "../shared/messages";
import { apiCall } from "./api";
import { importSingle } from "./importJobs";

const JOB_STORAGE_KEY = "makerworldCollectionJob";
const JOB_ERROR_STORAGE_KEY = "makerworldJobError";
// Pacing after each import, on top of however long the model page itself took to load --
// deliberately not configurable, since a shorter value would undercut the point of this feature.
const STEP_DELAY_MS = 5000;
// tabs.sendMessage has no timeout of its own -- if the content script's resolution ever stalls
// (its own fetches are bounded, but e.g. the listener could throw before replying) the job would
// otherwise sit forever behind a progress overlay that never moves. Comfortably above the content
// script's own worst case (an 8s click capture, then up to two 8s-bounded fallback fetches), so it
// only ever fires for a genuinely stuck resolution.
const DOWNLOAD_RESOLVE_TIMEOUT_MS = 30000;

async function getJob(): Promise<MakerworldJob | null> {
  const stored = await chrome.storage.local.get(JOB_STORAGE_KEY);
  return (stored[JOB_STORAGE_KEY] as MakerworldJob | undefined) ?? null;
}

async function setJob(job: MakerworldJob | null): Promise<void> {
  if (job) await chrome.storage.local.set({ [JOB_STORAGE_KEY]: job });
  else await chrome.storage.local.remove(JOB_STORAGE_KEY);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** Started once the user clicks "Start import" on a MakerWorld collection page -- `urls` is every
 *  not-yet-imported design's page URL (already-imported ones were filed into the destination
 *  collection by the content script before this runs). Stores the job, then makes the first move;
 *  tabs.onUpdated's "complete" handler drives every step after that. */
export async function startJob(tabId: number, { urls, collectionId, originalUrl }: { urls: string[]; collectionId: string | null; originalUrl: string }): Promise<null> {
  if (!urls.length) return null;
  await setJob({
    tabId,
    originalUrl,
    collectionId: collectionId || null,
    urls,
    index: 0,
    imported: 0,
    total: urls.length,
    awaitingLoad: true,
  });
  await chrome.tabs.update(tabId, { url: urls[0] });
  return null;
}

/** The overlay's Abort button -- returns the tab to where the run started and discards the rest of
 *  the queue. Nothing already imported is undone. */
export async function abortJob(tabId: number): Promise<null> {
  const job = await getJob();
  if (!job || job.tabId !== tabId) return null;
  await setJob(null);
  await chrome.tabs.update(tabId, { url: job.originalUrl });
  return null;
}

/** The job driving this tab, or (when there's none) a just-stopped job's error -- read-and-clear,
 *  surfaced exactly once, on the page that loads right after the job stops itself (always the
 *  original collection page, see advanceJob), not on a later unrelated visit. */
export async function getJobForTab(tabId: number | undefined): Promise<{ job: MakerworldJob | null; error: MakerworldJobError | null }> {
  const job = tabId != null ? await getJob() : null;
  if (job && job.tabId === tabId) return { job, error: null };
  const stored = await chrome.storage.local.get(JOB_ERROR_STORAGE_KEY);
  const error = (stored[JOB_ERROR_STORAGE_KEY] as MakerworldJobError | undefined) ?? null;
  if (error) await chrome.storage.local.remove(JOB_ERROR_STORAGE_KEY);
  return { job: null, error };
}

/** True as long as nothing else (most relevantly forceAdvanceJob) has already moved the job past
 *  the step a call started on. advanceJob and forceAdvanceJob can race to finish the same step --
 *  a large model can take long enough to import that someone clicks "Import next" before the
 *  original request comes back -- and this keeps a late automatic completion from double-advancing
 *  or clobbering a step the manual path already moved past. */
async function isStillAtStep(tabId: number, stepIndex: number): Promise<boolean> {
  const current = await getJob();
  return Boolean(current && current.tabId === tabId && current.index === stepIndex);
}

/** Paces, then moves to the next URL -- or, after the last one, back to the collection page the
 *  run started from. Shared by the normal completion and the manual "Import next". */
async function moveForward(tabId: number, job: MakerworldJob): Promise<void> {
  job.index += 1;
  if (job.index >= job.urls.length) {
    await setJob(null);
    await chrome.tabs.update(tabId, { url: job.originalUrl });
    return;
  }
  await setJob(job);
  await sleep(STEP_DELAY_MS);
  // The user may have hit Abort during the pacing delay -- re-check before navigating on.
  const stillActive = await getJob();
  if (!stillActive || stillActive.tabId !== tabId) return;
  job.awaitingLoad = true;
  await setJob(job);
  await chrome.tabs.update(tabId, { url: job.urls[job.index] });
}

/** Runs once the tab finishes loading the current step's model page: imports it, paces, moves on.
 *  Any import failure stops the whole run rather than skipping past it: this almost always means
 *  MakerWorld itself just rejected the request (CAPTCHA, rate limit, expired session), and firing
 *  more requests at that point would only make it worse. */
export async function advanceJob(tabId: number): Promise<void> {
  const job = await getJob();
  if (!job || job.tabId !== tabId || !job.awaitingLoad) return;
  const stepIndex = job.index;
  job.awaitingLoad = false;
  await setJob(job);

  const currentUrl = job.urls[stepIndex];
  // Ask the content script on the page we just navigated to (it has DOM access to __NEXT_DATA__
  // and a same-origin fetch carrying the real session cookie) to resolve the download URL itself.
  // This matters most here: it's this per-model loop that would otherwise fire MakerWorld
  // resolution calls back-to-back. Best-effort -- null lets the backend resolve it as before.
  let resolved = null;
  try {
    const reply = await withTimeout(sendToTab(tabId, "RESOLVE_MAKERWORLD_DOWNLOAD_URL"), DOWNLOAD_RESOLVE_TIMEOUT_MS);
    if (reply && reply.ok) resolved = reply.data;
  } catch {
    // No listener yet, or the tab navigated away already -- fine, see above.
  }

  try {
    await importSingle({ url: currentUrl, collectionId: job.collectionId, resolved });
  } catch (err) {
    // A manual "Import next" may have moved the job past this step while the request was in
    // flight -- then this failure is stale and says nothing about the current step.
    if (!(await isStillAtStep(tabId, stepIndex))) return;
    await setJob(null);
    const error: MakerworldJobError = { message: err instanceof Error ? err.message : String(err), imported: job.imported, total: job.total };
    await chrome.storage.local.set({ [JOB_ERROR_STORAGE_KEY]: error });
    await chrome.tabs.update(tabId, { url: job.originalUrl });
    return;
  }

  // Same staleness check on the success path, so a slow-but-alive request can't double-advance.
  if (!(await isStillAtStep(tabId, stepIndex))) return;
  job.imported += 1;
  await moveForward(tabId, job);
}

/** The overlay's "Import next" -- a manual escape hatch for when the automatic advance never comes
 *  back. The likeliest cause isn't MakerWorld: a model with an unusually large file can take long
 *  enough to import that MV3's background lifecycle limits kill this extension's background
 *  mid-request, silently dropping the await above (the import itself still completes server-side).
 *  So this confirms the stuck step actually landed in Thingport first (and files it into the
 *  destination collection if that got skipped too) before crediting it and continuing. */
export async function forceAdvanceJob(tabId: number): Promise<null> {
  const job = await getJob();
  if (!job || job.tabId !== tabId) return null;
  const currentUrl = job.urls[job.index];
  try {
    const status = await apiCall<ImportStatus>("GET", `/import/status?url=${encodeURIComponent(currentUrl)}`);
    if (status.already_imported) {
      job.imported += 1;
      if (job.collectionId && status.print_id) {
        await apiCall("POST", `/collection/${job.collectionId}/items/${status.print_id}`).catch(() => undefined);
      }
    }
  } catch {
    // Status check failed (instance unreachable, etc.) -- proceed anyway; the user already saw it
    // land in their library before reaching for this button.
  }
  await moveForward(tabId, job);
  return null;
}

/** The driven tab was closed outright -- no further tabs.onUpdated will ever act on the job, so
 *  drop it rather than leave it orphaned in storage. */
export async function dropJobIfForTab(tabId: number): Promise<void> {
  const job = await getJob();
  if (job && job.tabId === tabId) await setJob(null);
}
