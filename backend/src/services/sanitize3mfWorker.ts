import fs from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { writeSanitized3mf } from "./threeMfSanitizer";

// Worker entry point for one sanitize. Posts exactly one message, then exits.

export type Sanitize3mfWorkerInput = { srcPath: string; destPath: string };
export type Sanitize3mfWorkerResult = { status: "ok" } | { status: "error"; error: string };

async function run(): Promise<void> {
  const { srcPath, destPath } = workerData as Sanitize3mfWorkerInput;
  let result: Sanitize3mfWorkerResult;
  try {
    await writeSanitized3mf(await fs.readFile(srcPath), destPath);
    result = { status: "ok" };
  } catch (err) {
    result = { status: "error", error: err instanceof Error ? (err.stack ?? err.message) : String(err) };
  }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not window.postMessage.
  parentPort?.postMessage(result);
}

void run();
