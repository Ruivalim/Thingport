import type { ImportJob, Print } from "../shared/api";
import type { ImportSinglePayload } from "../shared/messages";
import { apiCall } from "./api";
import { recordRecentImport } from "./recentImports";

// Same ~1s cadence as the web app's ImportJobContext.tsx and the content script's batch poll.
const JOB_POLL_INTERVAL_MS = 1000;

export async function pollJobToCompletion(jobId: string): Promise<ImportJob> {
  for (;;) {
    const job = await apiCall<ImportJob>("GET", `/import/jobs/${jobId}`);
    if (job.status !== "RUNNING") return job;
    await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
  }
}

/** Runs a single-model import (direct or "choose files" zip entries) and, if a destination
 *  collection was picked, files the result into it -- as ONE message from the content script
 *  rather than two chained ones, so the whole sequence still completes even if the tab that started
 *  it navigates away or reloads a moment later. The background isn't torn down by a tab navigation
 *  the way a content script is, so once this has started, the import (and any collection filing)
 *  runs to completion regardless -- only the reply to a since-destroyed page can get lost. */
export async function importSingle({ url, entries, collectionId, resolved, title }: ImportSinglePayload): Promise<Print | null> {
  // For a MakerWorld model, the content script resolves the actual download URL from the live page
  // (see content/makerworld/downloadResolver.ts) -- passing it as resolved_download_url lets the
  // backend skip its own resolution, the only two places able to trip MakerWorld's CAPTCHA and its
  // 2-hour account-wide lockout. The profile id tells the backend which MakerWorld print profile
  // the file is, so importing another profile of a model already in the library adds it as a
  // second file instead of being skipped as a duplicate, and the page's design data spares the
  // backend fetching the model page for its details (often Cloudflare-blocked for a server).
  // Omitted when nothing was resolved.
  const extra = resolved?.downloadUrl
    ? {
        resolved_download_url: resolved.downloadUrl,
        resolved_instance_id: resolved.instanceId || null,
        makerworld_design: resolved.design ?? null,
      }
    : null;

  let print: Print | null;
  if (entries) {
    const { job_id } = await apiCall<{ job_id: string }>("POST", "/import/zip", { url, entries, ...extra });
    const job = await pollJobToCompletion(job_id);
    if (job.status === "ERROR") throw new Error(job.error_message || "Import failed");
    print = job.result_print_id ? { id: job.result_print_id } : null;
  } else {
    print = await apiCall<Print>("POST", "/import", { url, ...extra });
  }

  if (collectionId && print?.id) {
    await apiCall("POST", `/collection/${collectionId}/items/${print.id}`).catch(() => undefined);
  }
  // A no-op import (already in the library) isn't something the user just imported. Another
  // MakerWorld print profile of a model they already had returns that same model, so it lands as
  // the one entry, moved to the front.
  if (print?.id && print.import_outcome !== "already_imported") {
    await recordRecentImport(print, title ?? null).catch(() => undefined);
  }
  return print;
}
