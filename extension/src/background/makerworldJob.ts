// MakerWorld guided collection import: navigates the tab to each model's page and imports it
// there, one at a time. Real page loads pace the requests the way no config value can, which
// keeps MakerWorld's account-wide CAPTCHA from tripping.
//
// State lives in chrome.storage because an MV3 background can be suspended between steps.

import type { ImportStatus } from "../shared/api";
import type { MakerworldJob, MakerworldJobError } from "../shared/messages";
import { sendToTab } from "../shared/messages";
import { apiCall } from "./api";
import { importSingle } from "./importJobs";

const JOB_STORAGE_KEY = "makerworldCollectionJob";
const JOB_ERROR_STORAGE_KEY = "makerworldJobError";
// Not configurable: a shorter delay defeats the point.
const STEP_DELAY_MS = 5000;
// tabs.sendMessage has no timeout; this is well above the content script's own worst case.
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

/** `urls` are the not-yet-imported designs. tabs.onUpdated drives every step after the first. */
export async function startJob(
  tabId: number,
  { urls, collectionId, originalUrl }: { urls: string[]; collectionId: string | null; originalUrl: string },
): Promise<null> {
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

/** Returns the tab to where the run started. Nothing already imported is undone. */
export async function abortJob(tabId: number): Promise<null> {
  const job = await getJob();
  if (!job || job.tabId !== tabId) return null;
  await setJob(null);
  await chrome.tabs.update(tabId, { url: job.originalUrl });
  return null;
}

/** A just-stopped job's error is read-and-clear, so it's shown exactly once. */
export async function getJobForTab(
  tabId: number | undefined,
): Promise<{ job: MakerworldJob | null; error: MakerworldJobError | null }> {
  const job = tabId != null ? await getJob() : null;
  if (job && job.tabId === tabId) return { job, error: null };
  const stored = await chrome.storage.local.get(JOB_ERROR_STORAGE_KEY);
  const error = (stored[JOB_ERROR_STORAGE_KEY] as MakerworldJobError | undefined) ?? null;
  if (error) await chrome.storage.local.remove(JOB_ERROR_STORAGE_KEY);
  return { job: null, error };
}

/** Keeps a late automatic completion from double-advancing a step "Import next" already moved past. */
async function isStillAtStep(tabId: number, stepIndex: number): Promise<boolean> {
  const current = await getJob();
  return Boolean(current && current.tabId === tabId && current.index === stepIndex);
}

async function moveForward(tabId: number, job: MakerworldJob): Promise<void> {
  job.index += 1;
  if (job.index >= job.urls.length) {
    await setJob(null);
    await chrome.tabs.update(tabId, { url: job.originalUrl });
    return;
  }
  await setJob(job);
  await sleep(STEP_DELAY_MS);
  // The user may have hit Abort during the delay.
  const stillActive = await getJob();
  if (!stillActive || stillActive.tabId !== tabId) return;
  job.awaitingLoad = true;
  await setJob(job);
  await chrome.tabs.update(tabId, { url: job.urls[job.index] });
}

/** Any failure stops the run: it almost always means MakerWorld rejected the request, and more
 *  requests would make it worse. */
export async function advanceJob(tabId: number): Promise<void> {
  const job = await getJob();
  if (!job || job.tabId !== tabId || !job.awaitingLoad) return;
  const stepIndex = job.index;
  job.awaitingLoad = false;
  await setJob(job);

  const currentUrl = job.urls[stepIndex];
  // The content script resolves the download itself with the page's session. Best-effort: null
  // lets the backend resolve it.
  let resolved = null;
  try {
    const reply = await withTimeout(sendToTab(tabId, "RESOLVE_MAKERWORLD_DOWNLOAD_URL"), DOWNLOAD_RESOLVE_TIMEOUT_MS);
    if (reply && reply.ok) resolved = reply.data;
  } catch {}

  try {
    await importSingle({ url: currentUrl, collectionId: job.collectionId, resolved });
  } catch (err) {
    // A manual "Import next" may have moved past this step while the request was in flight.
    if (!(await isStillAtStep(tabId, stepIndex))) return;
    await setJob(null);
    const error: MakerworldJobError = {
      message: err instanceof Error ? err.message : String(err),
      imported: job.imported,
      total: job.total,
    };
    await chrome.storage.local.set({ [JOB_ERROR_STORAGE_KEY]: error });
    await chrome.tabs.update(tabId, { url: job.originalUrl });
    return;
  }

  if (!(await isStillAtStep(tabId, stepIndex))) return;
  job.imported += 1;
  await moveForward(tabId, job);
}

/** Manual escape hatch: MV3 can kill the background mid-request on a large import. Confirms the
 *  stuck step actually landed in Thingport before continuing. */
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
    // Status check failed: proceed anyway, the user saw it land before clicking.
  }
  await moveForward(tabId, job);
  return null;
}

export async function dropJobIfForTab(tabId: number): Promise<void> {
  const job = await getJob();
  if (job && job.tabId === tabId) await setJob(null);
}
