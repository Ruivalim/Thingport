import fs from "node:fs/promises";
import fsSync from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { MODEL_PREVIEWS, MODEL_PREVIEW_MAX_MEMORY_MB, MODEL_PREVIEW_TIMEOUT_SECONDS } from "../config";
import type { ModelPreviewWorkerInput, ModelPreviewWorkerResult } from "./modelPreviewWorker";

// Owns the pre-rendered GLB cache for the interactive 3D preview: which plates have one, which
// failed, and running the render itself -- in a worker thread (modelPreviewWorker.ts ->
// modelPreviewRender.ts) under a memory and time limit, so a pathological .3mf costs at most that
// thread, never the server's event loop or the host's memory.

// ---- Cache path helpers (same shape as printService.ts's plateThumbPath/plateThumbExists) -----

// Part of the cache filename, so a change to what buildGlbGroup produces makes every older GLB a
// cache miss and gets it regenerated on next view, rather than serving stale geometry forever.
// v2: the Z-up -> Y-up conversion became a rotation instead of a mirroring swap. v3: a component
// takes only its own object from a shared part file (multi-part models were built k times over).
// Failure markers carry it too, so a file an older renderer refused gets another attempt.
const PREVIEW_FORMAT_VERSION = 3;

export function modelPreviewGlbPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.v${PREVIEW_FORMAT_VERSION}.glb`);
}

/** Pre-versioning filename (v1) -- removed once its replacement is written. */
function legacyModelPreviewGlbPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.glb`);
}

function modelPreviewErrorPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.v${PREVIEW_FORMAT_VERSION}.error`);
}

/** Pre-versioning failure marker -- ignored, and removed alongside a successful render. */
function legacyModelPreviewErrorPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.error`);
}

/** Written before generation starts and removed when it ends (either way). Still being there
 * with nothing in flight means the process died mid-generation (OOM kill, container restart), so
 * that plate is never retried automatically -- delete this file to allow another attempt. */
function modelPreviewPendingPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.pending`);
}

export function modelPreviewGlbExists(plateId: string): boolean {
  return fsSync.existsSync(modelPreviewGlbPath(plateId));
}

// ---- Failure bookkeeping ------------------------------------------------------------------------

const ERROR_RETRY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
// Error-file prefix for failures that would just repeat (file refused as too complex, render
// killed for exceeding its limits): never retried automatically, unlike a transient error which
// gets another go after the cooldown. Delete the .error file to force a retry, e.g. after raising
// MODEL_PREVIEW_MAX_MEMORY_MB.
const PERMANENT_FAILURE_PREFIX = "permanent: ";
const UNSUPPORTED_MARKER = `${PERMANENT_FAILURE_PREFIX}unsupported`;

function recentlyFailed(plateId: string): boolean {
  const errorPath = modelPreviewErrorPath(plateId);
  try {
    const stat = fsSync.statSync(errorPath);
    if (Date.now() - stat.mtimeMs < ERROR_RETRY_COOLDOWN_MS) return true;
    return fsSync.readFileSync(errorPath, "utf-8").startsWith(PERMANENT_FAILURE_PREFIX);
  } catch {
    return false;
  }
}

// ---- Worker supervision -------------------------------------------------------------------------

// From compiled output (dist/*.js) the worker is plain JS. From TypeScript source (the `tsx watch`
// dev server, vitest) it needs tsx's CommonJS hook registered inside the thread first -- workers
// don't inherit the parent's loader, and on Node 20 `--import tsx` in the worker's execArgv doesn't
// apply to its entry file either, hence an eval'd bootstrap that requires both explicitly.
const WORKER_FILE = path.join(__dirname, `modelPreviewWorker${path.extname(__filename)}`);
const WORKER_BOOTSTRAP = WORKER_FILE.endsWith(".ts")
  ? `require(${JSON.stringify(createRequire(__filename).resolve("tsx/cjs"))}); require(${JSON.stringify(WORKER_FILE)});`
  : `require(${JSON.stringify(WORKER_FILE)});`;

const MEMORY_POLL_MS = 250;

type RenderOutcome =
  | { status: "ok" }
  | { status: "too-complex" }
  | { status: "unsupported" }
  | { status: "limit"; reason: string }
  | { status: "error"; error: string };

/** Runs one render in a fresh worker thread and resolves once that thread is gone (so its memory
 * is released before the next queued render starts). Never rejects. Limits:
 *  - heap: the worker's own V8 old-generation cap (resourceLimits) -- exceeding it terminates just
 *    the worker (ERR_WORKER_OUT_OF_MEMORY);
 *  - total memory: mesh data lives in typed arrays, outside any V8 heap cap, so a watchdog on this
 *    side also polls the process RSS and terminates the worker if it has grown past the budget
 *    since the render started;
 *  - time: terminated after MODEL_PREVIEW_TIMEOUT_SECONDS. */
function renderInWorker(input: ModelPreviewWorkerInput): Promise<RenderOutcome> {
  return new Promise((resolve) => {
    const maxGrowthBytes = MODEL_PREVIEW_MAX_MEMORY_MB * 1024 * 1024;
    const baselineRss = process.memoryUsage.rss();
    const worker = new Worker(WORKER_BOOTSTRAP, {
      eval: true,
      workerData: input,
      resourceLimits: { maxOldGenerationSizeMb: MODEL_PREVIEW_MAX_MEMORY_MB },
    });

    let settled = false;
    const finish = (outcome: RenderOutcome) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      clearTimeout(timeout);
      worker.terminate().then(
        () => resolve(outcome),
        () => resolve(outcome),
      );
    };

    const watchdog = setInterval(() => {
      const grown = process.memoryUsage.rss() - baselineRss;
      if (grown > maxGrowthBytes) {
        finish({
          status: "limit",
          reason: `memory grew by ${Math.round(grown / 1024 / 1024)} MB (limit ${MODEL_PREVIEW_MAX_MEMORY_MB} MB)`,
        });
      }
    }, MEMORY_POLL_MS);
    const timeout = setTimeout(
      () => finish({ status: "limit", reason: `took longer than ${MODEL_PREVIEW_TIMEOUT_SECONDS}s` }),
      MODEL_PREVIEW_TIMEOUT_SECONDS * 1000,
    );

    worker.once("message", (result: ModelPreviewWorkerResult) => finish(result));
    worker.once("error", (err: NodeJS.ErrnoException) => {
      finish(
        err.code === "ERR_WORKER_OUT_OF_MEMORY"
          ? { status: "limit", reason: `worker heap exceeded ${MODEL_PREVIEW_MAX_MEMORY_MB} MB` }
          : { status: "error", error: err.stack ?? String(err) },
      );
    });
    worker.once("exit", (code) => finish({ status: "error", error: `worker exited (code ${code}) without a result` }));
  });
}

// ---- Public entry point -------------------------------------------------------------------------

const inFlight = new Set<string>();
const crashWarned = new Set<string>();

// One render at a time, process-wide: a multi-profile import creates several .3mf plates at once,
// and rendering them in parallel would multiply peak memory past the per-render limit.
let queue: Promise<void> = Promise.resolve();

/** Generates (or refuses to, gracefully) the cached GLB for one plate. Always resolves --
 * never throws -- so callers can fire-and-forget it without a .catch(). Safe to call
 * concurrently for the same plateId (subsequent calls no-op while one is queued or running). */
export async function generateModelPreviewGlb(plateId: string, srcPath: string): Promise<void> {
  if (modelPreviewGlbExists(plateId) || inFlight.has(plateId) || recentlyFailed(plateId)) return;
  if (fsSync.existsSync(modelPreviewPendingPath(plateId))) {
    if (!crashWarned.has(plateId)) {
      crashWarned.add(plateId);
      console.warn(
        `Model preview for plate ${plateId} was interrupted by a previous crash; not retrying. ` +
          `Delete ${modelPreviewPendingPath(plateId)} to allow another attempt.`,
      );
    }
    return;
  }
  inFlight.add(plateId);
  const run = queue.then(() => runGeneration(plateId, srcPath));
  queue = run;
  await run;
}

/** Where a plate's preview stands, for the viewer to decide between waiting, giving up, and
 *  loading it: "generating" covers queued too; "failed" covers a file too heavy to preview, a
 *  render that hit its limits, and one interrupted by a crash -- none of which will retry on
 *  their own soon; "unsupported" is a 3MF layout the server's parser doesn't handle, left to the
 *  browser's more general loaders. */
export type ModelPreviewState = "ready" | "generating" | "failed" | "unsupported";

export function modelPreviewState(plateId: string): ModelPreviewState {
  if (modelPreviewGlbExists(plateId)) return "ready";
  if (inFlight.has(plateId)) return "generating";
  if (recentlyFailed(plateId)) {
    try {
      return fsSync.readFileSync(modelPreviewErrorPath(plateId), "utf-8") === UNSUPPORTED_MARKER ? "unsupported" : "failed";
    } catch {
      return "failed";
    }
  }
  if (fsSync.existsSync(modelPreviewPendingPath(plateId))) return "failed";
  return "generating";
}

async function runGeneration(plateId: string, srcPath: string): Promise<void> {
  const pendingPath = modelPreviewPendingPath(plateId);
  const errorPath = modelPreviewErrorPath(plateId);
  const dest = modelPreviewGlbPath(plateId);
  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(pendingPath, new Date().toISOString());
    const outcome = await renderInWorker({ srcPath, destPath: tmp });
    switch (outcome.status) {
      case "ok":
        await fs.rename(tmp, dest);
        await fs.rm(errorPath, { force: true });
        await fs.rm(legacyModelPreviewGlbPath(plateId), { force: true });
        await fs.rm(legacyModelPreviewErrorPath(plateId), { force: true });
        break;
      case "too-complex":
        await fs.writeFile(errorPath, `${PERMANENT_FAILURE_PREFIX}too-complex`);
        break;
      case "unsupported":
        await fs.writeFile(errorPath, UNSUPPORTED_MARKER);
        break;
      case "limit":
        console.warn(`Model preview for plate ${plateId} stopped: ${outcome.reason}`);
        await fs.writeFile(errorPath, `${PERMANENT_FAILURE_PREFIX}${outcome.reason}`);
        break;
      case "error":
        console.error(`Model preview generation failed for plate ${plateId}:`, outcome.error);
        await fs.writeFile(errorPath, outcome.error);
        break;
    }
  } catch (err) {
    console.error(`Model preview generation failed for plate ${plateId}:`, err);
    await fs.writeFile(errorPath, String(err)).catch(() => undefined);
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    await fs.rm(pendingPath, { force: true }).catch(() => undefined);
    inFlight.delete(plateId);
  }
}
