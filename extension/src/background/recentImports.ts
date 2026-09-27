// The popup's "Recent imports" strip: the last few models imported through this extension, in this
// browser -- kept entirely in extension storage, title and thumbnail included, so the popup never
// has to ask the instance for anything. The flip side: an entry reflects the model as it was when
// imported (a later rename or delete in Thingport doesn't show here).

import type { Print } from "../shared/api";
import type { RecentImport } from "../shared/messages";
import { normalizeInstanceUrl } from "../shared/storage";
import { apiFetchBlob } from "./api";
import { getStoredConfig, isConfigured, type ConfiguredConfig } from "./config";

const RECENT_IMPORTS_STORAGE_KEY = "recentImports";
const RECENT_IMPORTS_KEPT = 5;
const RECENT_IMPORT_THUMB_PX = 96;

async function readStored(): Promise<RecentImport[]> {
  const stored = await chrome.storage.local.get(RECENT_IMPORTS_STORAGE_KEY);
  return (stored[RECENT_IMPORTS_STORAGE_KEY] as RecentImport[] | undefined) ?? [];
}

/** `print` is POST /import's response (or just `{ id }` for a zip import, whose job reports only
 *  the id -- `titleHint`, the page's own title, covers that case). Entries are scoped to the
 *  instance + account they were imported into, so switching either shows that one's own list. */
export async function recordRecentImport(print: Print, titleHint: string | null): Promise<void> {
  const config = await getStoredConfig();
  if (!isConfigured(config)) return;
  const instanceUrl = normalizeInstanceUrl(config.instanceUrl);
  // Same cover the web app's model cards use, falling back to the first photo.
  const thumbPath = print.thumb_url || print.preview_images?.[0]?.url || null;
  const entry: RecentImport = {
    printId: print.id,
    title: print.title || print.name || titleHint || null,
    url: `${instanceUrl}/models/${print.id}`,
    thumbDataUrl: thumbPath ? await fetchThumbDataUrl(config, thumbPath).catch(() => null) : null,
    instanceUrl,
    email: config.email,
  };
  // Another MakerWorld print profile of a model already in the list is the same model -- it moves
  // to the front rather than taking a second slot.
  const rest = (await readStored()).filter(
    (e) => !(e.printId === entry.printId && e.instanceUrl === instanceUrl && e.email === entry.email),
  );
  await chrome.storage.local.set({ [RECENT_IMPORTS_STORAGE_KEY]: [entry, ...rest].slice(0, RECENT_IMPORTS_KEPT) });
}

/** Downloads the model's cover once and shrinks it to a small square JPEG data URL (a few KB),
 *  center-cropped the way the popup shows it. */
async function fetchThumbDataUrl(config: ConfiguredConfig, thumbPath: string): Promise<string | null> {
  const blob = await apiFetchBlob(config, thumbPath);
  if (!blob) return null;
  const bitmap = await createImageBitmap(blob);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(RECENT_IMPORT_THUMB_PX, RECENT_IMPORT_THUMB_PX);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, RECENT_IMPORT_THUMB_PX, RECENT_IMPORT_THUMB_PX);
  bitmap.close();
  const jpeg = new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 })).arrayBuffer());
  let binary = "";
  for (let i = 0; i < jpeg.length; i += 0x8000) binary += String.fromCharCode(...jpeg.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

export async function getRecentImports(): Promise<RecentImport[]> {
  const config = await getStoredConfig();
  if (!isConfigured(config)) return [];
  const instanceUrl = normalizeInstanceUrl(config.instanceUrl);
  return (await readStored()).filter((e) => e.instanceUrl === instanceUrl && e.email === config.email);
}
