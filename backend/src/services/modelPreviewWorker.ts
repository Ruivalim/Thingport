import { parentPort, workerData } from "node:worker_threads";
import { renderModelPreviewGlb } from "./modelPreviewRender";

// Worker-thread entry point for one preview render (spawned per job by modelPreviewCache.ts, which
// enforces the memory/time limits). Reports exactly one message, then lets the thread exit.

export type ModelPreviewWorkerInput = { srcPath: string; destPath: string };
export type ModelPreviewWorkerResult =
  | { status: "ok" }
  | { status: "too-complex" }
  | { status: "unsupported" }
  | { status: "error"; error: string };

async function run(): Promise<void> {
  const { srcPath, destPath } = workerData as ModelPreviewWorkerInput;
  let result: ModelPreviewWorkerResult;
  try {
    result = { status: await renderModelPreviewGlb(srcPath, destPath) };
  } catch (err) {
    result = { status: "error", error: err instanceof Error ? err.stack ?? err.message : String(err) };
  }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not window.postMessage.
  parentPort?.postMessage(result);
}

void run();
