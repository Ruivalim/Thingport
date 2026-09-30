import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { MODEL_PREVIEW_MAX_MEMORY_MB, SANITIZE_3MF_TIMEOUT_SECONDS, SANITIZED_3MFS } from "../config";
import { workerBootstrap } from "../utils/workerBootstrap";
import type { Sanitize3mfWorkerInput, Sanitize3mfWorkerResult } from "./sanitize3mfWorker";

// Part of the cache filename, so bumping it rebuilds older copies on next request.
const SANITIZE_FORMAT_VERSION = 1;

const WORKER_BOOTSTRAP = workerBootstrap(__dirname, "sanitize3mfWorker");

function sanitizedPath(plateId: string): string {
  return path.join(SANITIZED_3MFS, `${plateId}.v${SANITIZE_FORMAT_VERSION}.3mf`);
}

// Marks a source the sanitizer rejected, so each request doesn't redo the work to fail again.
function errorPath(plateId: string): string {
  return path.join(SANITIZED_3MFS, `${plateId}.v${SANITIZE_FORMAT_VERSION}.error`);
}

/** Sliced .gcode.3mf plates are left alone: dropping their G-code would leave nothing to print. */
export function isSanitizable3mf(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".3mf") && !lower.endsWith(".gcode.3mf");
}

async function isFresh(file: string, srcMtimeMs: number): Promise<boolean> {
  try {
    return (await fs.stat(file)).mtimeMs >= srcMtimeMs;
  } catch {
    return false;
  }
}

function sanitizeInWorker(input: Sanitize3mfWorkerInput): Promise<Sanitize3mfWorkerResult> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_BOOTSTRAP, {
      eval: true,
      workerData: input,
      resourceLimits: { maxOldGenerationSizeMb: MODEL_PREVIEW_MAX_MEMORY_MB },
    });
    let settled = false;
    const finish = (result: Sanitize3mfWorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate().then(
        () => resolve(result),
        () => resolve(result),
      );
    };
    const timeout = setTimeout(
      () => finish({ status: "error", error: `took longer than ${SANITIZE_3MF_TIMEOUT_SECONDS}s` }),
      SANITIZE_3MF_TIMEOUT_SECONDS * 1000,
    );
    worker.once("message", finish);
    worker.once("error", (err) => finish({ status: "error", error: err.stack ?? String(err) }));
    worker.once("exit", (code) => finish({ status: "error", error: `worker exited (code ${code}) without a result` }));
  });
}

async function buildSanitized(plateId: string, srcPath: string): Promise<string | null> {
  const dest = sanitizedPath(plateId);
  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(SANITIZED_3MFS, { recursive: true });
  try {
    const result = await sanitizeInWorker({ srcPath, destPath: tmp });
    if (result.status === "ok") {
      await fs.rename(tmp, dest);
      await fs.rm(errorPath(plateId), { force: true });
      return dest;
    }
    console.warn(`Sanitizing 3MF for plate ${plateId} failed; serving the original:`, result.error);
    await fs.writeFile(errorPath(plateId), result.error);
    return null;
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
  }
}

const inFlight = new Map<string, Promise<string | null>>();
// One at a time: a large 3MF is held in memory several times over while it's rewritten.
let queue: Promise<unknown> = Promise.resolve();

// A failure is retried after this, so a timeout on a busy server doesn't block the plate for good.
const ERROR_RETRY_MS = 60 * 60 * 1000;

async function recentlyFailed(plateId: string, srcMtimeMs: number): Promise<boolean> {
  try {
    const { mtimeMs } = await fs.stat(errorPath(plateId));
    return mtimeMs >= srcMtimeMs && Date.now() - mtimeMs < ERROR_RETRY_MS;
  } catch {
    return false;
  }
}

function startJob(plateId: string, srcPath: string): Promise<string | null> {
  let pending = inFlight.get(plateId);
  if (!pending) {
    pending = queue.then(() => buildSanitized(plateId, srcPath));
    queue = pending.catch(() => undefined);
    inFlight.set(plateId, pending);
    void pending.finally(() => inFlight.delete(plateId)).catch(() => undefined);
  }
  return pending;
}

export type Sanitize3mfStatus = "ready" | "preparing" | "failed";

/** Starts a sanitize in the background when there's no usable copy yet. Never throws. */
export async function sanitize3mfStatus(plateId: string, srcPath: string): Promise<Sanitize3mfStatus> {
  try {
    const { mtimeMs } = await fs.stat(srcPath);
    if (await isFresh(sanitizedPath(plateId), mtimeMs)) return "ready";
    if (inFlight.has(plateId)) return "preparing";
    if (await recentlyFailed(plateId, mtimeMs)) return "failed";
    void startJob(plateId, srcPath).catch(() => undefined);
    return "preparing";
  } catch (err) {
    console.error(`Sanitizing 3MF for plate ${plateId} failed:`, err);
    return "failed";
  }
}

/** Path to a slicer-compatible copy of the plate's 3MF, waiting for one if needed, or null to serve
 *  the original. Never throws. */
export async function sanitized3mfFor(plateId: string, srcPath: string): Promise<string | null> {
  try {
    const { mtimeMs } = await fs.stat(srcPath);
    if (await isFresh(sanitizedPath(plateId), mtimeMs)) return sanitizedPath(plateId);
    if (!inFlight.has(plateId) && (await recentlyFailed(plateId, mtimeMs))) return null;
    return await startJob(plateId, srcPath);
  } catch (err) {
    console.error(`Sanitizing 3MF for plate ${plateId} failed:`, err);
    return null;
  }
}

export async function deleteSanitized3mf(plateId: string): Promise<void> {
  await fs.rm(sanitizedPath(plateId), { force: true }).catch(() => undefined);
  await fs.rm(errorPath(plateId), { force: true }).catch(() => undefined);
}
