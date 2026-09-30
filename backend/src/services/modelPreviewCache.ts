import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { MODEL_PREVIEWS, MODEL_PREVIEW_MAX_MEMORY_MB, MODEL_PREVIEW_TIMEOUT_SECONDS } from "../config";
import type { ModelPreviewWorkerInput, ModelPreviewWorkerResult } from "./modelPreviewWorker";
import { getSimplifyPreviews } from "./settingsService";
import { workerBootstrap } from "../utils/workerBootstrap";

// Renders run in a worker thread under memory and time limits, so a pathological .3mf can't take
// down the server.

// Part of the cache filename, so bumping it regenerates older GLBs on next view. Failure markers
// carry it too, so a file an older renderer refused gets another attempt.
const PREVIEW_FORMAT_VERSION = 3;

export function modelPreviewGlbPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.v${PREVIEW_FORMAT_VERSION}.glb`);
}

function legacyModelPreviewGlbPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.glb`);
}

function modelPreviewErrorPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.v${PREVIEW_FORMAT_VERSION}.error`);
}

function legacyModelPreviewErrorPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.error`);
}

/** Left behind when the process died mid-render (e.g. OOM), so that plate isn't retried
 * automatically. Delete it to allow another attempt. */
function modelPreviewPendingPath(plateId: string): string {
  return path.join(MODEL_PREVIEWS, `${plateId}.pending`);
}

export function modelPreviewGlbExists(plateId: string): boolean {
  return fsSync.existsSync(modelPreviewGlbPath(plateId));
}

const ERROR_RETRY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
// Failures that would just repeat (too complex, killed for limits) are never retried
// automatically. Delete the .error file to force a retry.
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

const WORKER_BOOTSTRAP = workerBootstrap(__dirname, "modelPreviewWorker");

const MEMORY_POLL_MS = 250;

// Models rarely look different above 1M triangles on screen. Defined here so the server thread
// never loads the renderer.
export const SIMPLIFY_TARGET_TRIANGLES = 1_000_000;

type RenderOutcome =
  | { status: "ok" }
  | { status: "too-complex" }
  | { status: "unsupported" }
  | { status: "limit"; reason: string }
  | { status: "error"; error: string };

/** Resolves once the thread is gone, so its memory is freed before the next render. Never
 * rejects. Mesh data lives outside the V8 heap cap, so a watchdog also polls process RSS. */
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

const inFlight = new Set<string>();
const crashWarned = new Set<string>();

// One render at a time: parallel renders would multiply peak memory past the limit.
let queue: Promise<void> = Promise.resolve();

/** Never throws. Concurrent calls for the same plate no-op. */
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

/** "failed" won't retry soon; "unsupported" is left to the browser's loaders. */
export type ModelPreviewState = "ready" | "generating" | "failed" | "unsupported";

export function modelPreviewState(plateId: string): ModelPreviewState {
  if (modelPreviewGlbExists(plateId)) return "ready";
  if (inFlight.has(plateId)) return "generating";
  if (recentlyFailed(plateId)) {
    try {
      return fsSync.readFileSync(modelPreviewErrorPath(plateId), "utf-8") === UNSUPPORTED_MARKER
        ? "unsupported"
        : "failed";
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
    const simplify = await getSimplifyPreviews();
    const outcome = await renderInWorker({
      srcPath,
      destPath: tmp,
      options: { simplifyTo: simplify ? SIMPLIFY_TARGET_TRIANGLES : null },
    });
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

type GlbSummary = { triangles: number; simplified: boolean };

/** Reads only a cached GLB's JSON chunk. Null for a file this renderer didn't write. */
async function readGlbSummary(file: string): Promise<GlbSummary | null> {
  const handle = await fs.open(file, "r");
  try {
    const header = Buffer.alloc(20);
    await handle.read(header, 0, 20, 0);
    if (header.readUInt32LE(0) !== 0x46546c67 || header.readUInt32LE(16) !== 0x4e4f534a) return null;
    const json = Buffer.alloc(header.readUInt32LE(12));
    await handle.read(json, 0, json.length, 20);
    const gltf = JSON.parse(json.toString("utf-8")) as {
      accessors?: { count: number }[];
      meshes?: { primitives: { indices?: number }[] }[];
      nodes?: { extras?: { thingportPreview?: string } }[];
    };
    let triangles = 0;
    for (const mesh of gltf.meshes ?? []) {
      for (const primitive of mesh.primitives) {
        if (primitive.indices !== undefined) triangles += (gltf.accessors?.[primitive.indices]?.count ?? 0) / 3;
      }
    }
    const meta = gltf.nodes?.find((node) => typeof node.extras?.thingportPreview === "string")?.extras
      ?.thingportPreview;
    const simplified = meta ? Boolean((JSON.parse(meta) as { simplified?: unknown }).simplified) : false;
    return { triangles, simplified };
  } finally {
    await handle.close();
  }
}

/** Removes the cached previews the new setting would change, so they're rebuilt on next view. */
export async function dropPreviewsAffectedBySimplification(simplify: boolean): Promise<number> {
  const suffix = `.v${PREVIEW_FORMAT_VERSION}.glb`;
  let removed = 0;
  let names: string[];
  try {
    names = await fs.readdir(MODEL_PREVIEWS);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (!name.endsWith(suffix)) continue;
    const file = path.join(MODEL_PREVIEWS, name);
    try {
      const summary = await readGlbSummary(file);
      if (!summary) continue;
      const affected = simplify
        ? !summary.simplified && summary.triangles > SIMPLIFY_TARGET_TRIANGLES
        : summary.simplified;
      if (affected) {
        await fs.rm(file, { force: true });
        removed++;
      }
    } catch (err) {
      console.warn(`Couldn't check cached preview ${name} after a simplification change`, err);
    }
  }
  return removed;
}
