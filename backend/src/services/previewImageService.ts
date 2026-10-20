import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PREVIEWS } from "../config";
import { prisma } from "../db";
import { generateModelImage } from "./modelPreviewCache";
import { plateThumbExists, plateThumbReplaceable, saveThumbFromBytes } from "./printService";
import type { PreviewImage } from "@prisma/client";

export function previewImagePath(id: string): string {
  return path.join(PREVIEWS, `${id}.jpg`);
}

export function previewImageExists(id: string): boolean {
  return fsSync.existsSync(previewImagePath(id));
}

async function saveBuffer(id: string, input: Buffer): Promise<boolean> {
  const dest = previewImagePath(id);
  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
  try {
    // Hero-sized: this is the detail page's main image.
    await sharp(input)
      .flatten({ background: { r: 248, g: 250, b: 252 } })
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(tmp);
    await fs.rename(tmp, dest);
    return true;
  } catch {
    await fs.rm(tmp, { force: true });
    return false;
  }
}

/** Null if the buffer isn't a decodable image; never throws. */
export async function addPreviewImage(
  printId: string,
  buffer: Buffer,
  generated = false,
): Promise<PreviewImage | null> {
  const last = await prisma.previewImage.findFirst({ where: { printId }, orderBy: { position: "desc" } });
  const position = last ? last.position + 1 : 0;
  const row = await prisma.previewImage.create({ data: { printId, position, generated } });
  const ok = await saveBuffer(row.id, buffer);
  if (!ok) {
    await prisma.previewImage.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  return row;
}

/** An existing image (e.g. an import's cover) always wins. */
export async function addGeneratedPreviewImageIfNone(printId: string, buffer: Buffer): Promise<void> {
  const count = await prisma.previewImage.count({ where: { printId } });
  if (count > 0) return;
  await addPreviewImage(printId, buffer, true);
}

/** Drops our own renders, so the images that replace them start at position 0. */
export async function removeGeneratedPreviewImages(printId: string): Promise<void> {
  const generated = await prisma.previewImage.findMany({ where: { printId, generated: true } });
  if (!generated.length) return;
  await prisma.previewImage.deleteMany({ where: { id: { in: generated.map((img) => img.id) } } });
  const remaining = await prisma.previewImage.findMany({ where: { printId }, orderBy: { position: "asc" } });
  // Two-phase renumber, as in plates.ts, to avoid (printId, position) collisions.
  await prisma.$transaction(
    remaining.map((img, idx) => prisma.previewImage.update({ where: { id: img.id }, data: { position: -(idx + 1) } })),
  );
  await prisma.$transaction(
    remaining.map((img, idx) => prisma.previewImage.update({ where: { id: img.id }, data: { position: idx } })),
  );
  for (const img of generated) await fs.rm(previewImagePath(img.id), { force: true }).catch(() => undefined);
}

/** Call once a real image is added: it takes over from our own render, as the cover and, when the plate's thumb is
 *  only that render (it can land first while the image is still uploading), as the thumb too. */
export async function preferImageOverRenders(
  printId: string,
  plateId: string | null | undefined,
  buffer: Buffer,
): Promise<void> {
  await removeGeneratedPreviewImages(printId);
  if (plateId && (await plateThumbReplaceable(plateId))) await saveThumbFromBytes(plateId, buffer);
}

export async function deleteAllPreviewImages(printId: string): Promise<void> {
  const rows = await prisma.previewImage.findMany({ where: { printId } });
  await prisma.previewImage.deleteMany({ where: { printId } });
  for (const row of rows) {
    await fs.rm(previewImagePath(row.id), { force: true }).catch(() => undefined);
  }
}

// The card render is white shading for the cards to tint, too pale on a light background as it is; as a thumb it's
// slate, like the live viewer's model.
const RENDER_THUMB_SHADE = [0.58, 0.64, 0.72, 1];

/** Our own render stands in as the plate's thumb, and the model's cover, while it has no picture at all, so mosaics
 *  and lists that show thumbs have one without the model being opened. */
async function adoptRenderAsThumb(plateId: string, renderPath: string): Promise<void> {
  if (plateThumbExists(plateId)) return;
  const plate = await prisma.plate.findUnique({ where: { id: plateId }, select: { printId: true } });
  if (!plate) return;
  const buffer = await sharp(renderPath).linear(RENDER_THUMB_SHADE, [0, 0, 0, 0]).png().toBuffer();
  if (!(await saveThumbFromBytes(plateId, buffer))) return;
  await prisma.plate.update({ where: { id: plateId }, data: { thumbGenerated: true } });
  await addGeneratedPreviewImageIfNone(plate.printId, buffer);
}

/** Queues the model card's render. Never throws. */
export function generateCardRender(plateId: string, srcPath: string, filename: string): Promise<void> {
  return generateModelImage(plateId, srcPath, filename, "render", (renderPath) =>
    adoptRenderAsThumb(plateId, renderPath).catch((err) => console.error(`Render thumb failed for ${plateId}:`, err)),
  );
}
