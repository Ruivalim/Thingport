import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { STORAGE, THUMBS, BUNDLES, PREVIEWS, MODEL_PREVIEWS, SANITIZED_3MFS } from "./config";

for (const dir of [STORAGE, THUMBS, BUNDLES, PREVIEWS, MODEL_PREVIEWS, SANITIZED_3MFS]) {
  fs.mkdirSync(dir, { recursive: true });
}

let client = new PrismaClient();

// Forwards to whichever client is current, so databaseSettingsService.ts can swap it without
// every importer holding a stale reference.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    return Reflect.get(client as object, prop, client);
  },
});

/** Only called after the new connection has been verified. */
export function setActiveClient(next: PrismaClient): void {
  const old = client;
  client = next;
  void old.$disconnect().catch(() => undefined);
}
