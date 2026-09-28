import { parentPort, workerData } from "node:worker_threads";
import { renderModelPreviewGlb, type RenderOptions } from "./modelPreviewRender";

// Worker entry point for one preview render. Posts exactly one message, then exits.

export type ModelPreviewWorkerInput = { srcPath: string; destPath: string; options: RenderOptions };
export type ModelPreviewWorkerResult =
  { status: "ok" } | { status: "too-complex" } | { status: "unsupported" } | { status: "error"; error: string };

async function run(): Promise<void> {
  const { srcPath, destPath, options } = workerData as ModelPreviewWorkerInput;
  let result: ModelPreviewWorkerResult;
  try {
    result = { status: await renderModelPreviewGlb(srcPath, destPath, options) };
  } catch (err) {
    result = { status: "error", error: err instanceof Error ? (err.stack ?? err.message) : String(err) };
  }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not window.postMessage.
  parentPort?.postMessage(result);
}

void run();
