import fs from "node:fs/promises";
import fsSync from "node:fs";
import { prisma } from "../db";
import type { Plate, Print, Prisma } from "@prisma/client";
import { HttpError } from "../utils/fileUtils";
import { IMPORT_MAKERWORLD_CALL_DELAY_MS } from "../config";
import {
  attachImportedPreviewImages,
  buildImportSourceUrl,
  downloadPlainFileToTemp,
  fetchMakerworldDesignForImport,
  importPrintFromUrl,
  MULTI_FILE_PLATE_EXTS,
  plateContentSha256,
  resolveCategoryIdByCategory,
  sha256OfFile,
} from "./importService";
import { parseMakerworldModelUrl, selectMakerworldProfiles } from "./makerworldCloudApi";
import {
  emptyImportedPageMetadata,
  makerworldMetaFromDesign,
  resolveMakerworldCookie,
  type ImportedPageMetadata,
} from "./importResolvers";
import { resolveThingiverseThing, ThingiverseAuthError, ThingiverseRateLimitError } from "./thingiverseApi";
import { parsePrintablesModelUrl, resolvePrintablesDownloadLinks, resolvePrintablesModel } from "./printablesApi";
import { getThingiverseAccessToken } from "./settingsService";
import { getUserMakerworldCookie } from "./makerworldCookieService";
import { upsertAuthorFromImport } from "./authorService";
import { addPlatesToPrint } from "./printCreation";

export type ReimportOptions = {
  metadata: boolean;
  files: boolean;
  images: boolean;
};

/** What the refresh changed, for the caller's toast. Fields that were already filled are left
 *  alone, so nothing a user edited by hand is overwritten. */
export type ReimportResult = {
  source_url: string;
  title_filled: boolean;
  notes_filled: boolean;
  tags_added: string[];
  creator_filled: boolean;
  author_linked: boolean;
  category_filled: boolean;
  files_added: number;
  files_already_present: number;
  images_added: number;
};

type SourceSnapshot = {
  meta: ImportedPageMetadata;
  /** Model files the source currently offers, each with a working download. */
  fileDownloads: { name: string; url: string }[];
  /** MakerWorld only: the profiles this design offers. */
  makerworld?: { designId: string; profileIds: string[] };
};

/** Reads what the source offers right now. Files are only listed, never downloaded here. */
async function fetchSourceSnapshot(userId: string, print: Print, sourceUrl: string): Promise<SourceSnapshot> {
  const provider = print.sourceProvider!;
  const externalId = print.sourceExternalId!;

  if (provider === "makerworld") {
    const parsed = parseMakerworldModelUrl(sourceUrl);
    if (!parsed) throw new HttpError(400, "Not a MakerWorld model link");
    const cookie = await getUserMakerworldCookie(userId);
    const design = await fetchMakerworldDesignForImport(
      parsed.designId,
      resolveMakerworldCookie({ makerworld_cookie: cookie }),
      IMPORT_MAKERWORLD_CALL_DELAY_MS,
    );
    if (!design) throw new HttpError(400, "Couldn't read this model's print profiles from MakerWorld");
    return {
      meta: makerworldMetaFromDesign(design),
      fileDownloads: [],
      makerworld: {
        designId: parsed.designId,
        profileIds: selectMakerworldProfiles(design, "all", parsed.requestedInstanceId),
      },
    };
  }

  if (provider === "thingiverse") {
    const accessToken = await getThingiverseAccessToken();
    if (!accessToken) {
      throw new HttpError(
        503,
        "Thingiverse import isn't configured for this instance yet -- ask an admin to add an Access Token in Admin Settings.",
      );
    }
    let resolved;
    try {
      resolved = await resolveThingiverseThing(externalId, accessToken);
    } catch (err) {
      if (err instanceof ThingiverseRateLimitError) throw new HttpError(429, err.message);
      if (err instanceof ThingiverseAuthError) throw new HttpError(400, err.message);
      throw err;
    }
    if (!resolved) {
      throw new HttpError(
        404,
        "This Thingiverse Thing could not be found, or isn't accessible with the configured Access Token.",
      );
    }
    return {
      meta: {
        ...emptyImportedPageMetadata(),
        ...resolved.meta,
        galleryImages: resolved.galleryImages.map((image) => ({ url: image.url, filename: image.name })),
      },
      fileDownloads: modelFilesOf(resolved.plateFiles),
    };
  }

  if (provider === "printables") {
    const parsed = parsePrintablesModelUrl(sourceUrl);
    if (!parsed) throw new HttpError(400, "Not a Printables model link");
    const resolved = await resolvePrintablesModel(externalId);
    if (!resolved) throw new HttpError(404, "This Printables model could not be found, or isn't public.");
    const modelFiles = modelFilesOf(resolved.plateFiles);
    const links = modelFiles.length
      ? await resolvePrintablesDownloadLinks(
          externalId,
          resolved.plateFiles.map((f) => f.id),
        )
      : new Map<string, string>();
    return {
      meta: {
        ...emptyImportedPageMetadata(),
        ...resolved.meta,
        galleryImages: resolved.galleryImages.map((image) => ({ url: image.url, filename: image.name })),
      },
      fileDownloads: resolved.plateFiles
        .filter((f) => MULTI_FILE_PLATE_EXTS.has(extensionOf(f.name)))
        .map((f) => ({ name: f.name, url: links.get(f.id) ?? "" }))
        .filter((f) => Boolean(f.url)),
    };
  }

  throw new HttpError(400, "This model has no source that can be re-imported from");
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function modelFilesOf(files: { name: string; url?: string }[]): { name: string; url: string }[] {
  return files
    .filter((f) => MULTI_FILE_PLATE_EXTS.has(extensionOf(f.name)))
    .map((f) => ({ name: f.name, url: f.url ?? "" }))
    .filter((f) => Boolean(f.url));
}

/** Fills only what's empty: an edited title, note or creator always wins over the source. Tags are
 *  additive, never removed. */
async function fillEmptyMetadata(
  userId: string,
  print: Print,
  meta: ImportedPageMetadata,
): Promise<{
  title: boolean;
  notes: boolean;
  tagsAdded: string[];
  creator: boolean;
  author: boolean;
  category: boolean;
}> {
  const updates: Prisma.PrintUpdateInput = {};
  let title = false;
  let notes = false;
  let creator = false;
  let author = false;
  let category = false;
  let tagsAdded: string[] = [];

  if (!print.title && meta.title) {
    updates.title = meta.title;
    title = true;
  }
  if (!print.notes && meta.description) {
    updates.notes = meta.description;
    notes = true;
  }
  const haveTags = new Set(print.tags.map((tag) => tag.toLowerCase()));
  tagsAdded = meta.tags.filter((tag) => !haveTags.has(tag.toLowerCase()));
  if (tagsAdded.length) updates.tags = [...print.tags, ...tagsAdded];
  if (!print.creator && meta.creator) {
    updates.creator = meta.creator;
    creator = true;
  }
  if (!print.authorId && meta.author) {
    const linked = await upsertAuthorFromImport(meta.author);
    if (linked) {
      updates.author = { connect: { id: linked.id } };
      author = true;
    }
  }
  if (!print.categoryId) {
    const categoryId = await resolveCategoryIdByCategory(userId, meta.categorySite, meta.siteCategoryIds);
    if (categoryId) {
      updates.category = { connect: { id: categoryId } };
      category = true;
    }
  }
  if (Object.keys(updates).length) await prisma.print.update({ where: { id: print.id }, data: updates });
  return { title, notes, tagsAdded, creator, author, category };
}

/** A source file that isn't byte-identical to any plate comes in as a new plate; anything the
 *  library already holds is skipped. */
async function addMissingPlainFiles(
  userId: string,
  print: Print,
  plates: Plate[],
  downloads: { name: string; url: string }[],
): Promise<{ added: number; alreadyPresent: number }> {
  const existingShas = new Set(
    (await Promise.all(plates.map(plateContentSha256))).filter((sha): sha is string => sha !== null),
  );
  let added = 0;
  let alreadyPresent = 0;
  for (const file of downloads) {
    const downloaded = await downloadPlainFileToTemp(file.url, file.name);
    if (!downloaded) {
      alreadyPresent++;
      continue;
    }
    if ("rateLimited" in downloaded) {
      throw new HttpError(
        429,
        "The source blocked a file download with a rate-limit challenge. Wait a while, then re-import again.",
      );
    }
    const input = downloaded.input;
    try {
      const sha = input.tempFilePath ? await sha256OfFile(input.tempFilePath) : null;
      if (sha && existingShas.has(sha)) {
        alreadyPresent++;
        continue;
      }
      await addPlatesToPrint(userId, print.id, [input]);
      if (sha) existingShas.add(sha);
      added++;
    } finally {
      if (input.tempFilePath && fsSync.existsSync(input.tempFilePath)) {
        await fs.rm(input.tempFilePath, { force: true }).catch(() => undefined);
      }
    }
  }
  return { added, alreadyPresent };
}

/** Refreshes one imported model from its source: fills empty metadata, brings in files the library
 *  doesn't hold yet (MakerWorld: the print profiles still missing), and fills an empty image slot.
 *  The source is whatever `sourceProvider`/`sourceExternalId` recorded at import time. */
export async function reimportPrint(userId: string, printId: string, opts: ReimportOptions): Promise<ReimportResult> {
  const print = await prisma.print.findFirst({
    where: { id: printId, userId },
    include: { plates: true, previewImages: true },
  });
  if (!print) throw new HttpError(404, "Model not found");
  const sourceUrl = buildImportSourceUrl(print.sourceProvider, print.sourceExternalId);
  if (!sourceUrl) throw new HttpError(400, "This model has no recorded source to re-import from");

  const snapshot = await fetchSourceSnapshot(userId, print, sourceUrl);

  let metadata = {
    title: false,
    notes: false,
    tagsAdded: [] as string[],
    creator: false,
    author: false,
    category: false,
  };
  if (opts.metadata) metadata = await fillEmptyMetadata(userId, print, snapshot.meta);

  let imagesAdded = 0;
  // Only our own 3D renders count as an empty slot; the import replaces them.
  if (opts.images && print.previewImages.every((image) => image.generated)) {
    await attachImportedPreviewImages(
      print.id,
      print.plates[0]?.id,
      snapshot.meta.previewImageUrl,
      snapshot.meta.galleryImages.map((image) => ({ url: image.url, filename: image.filename })),
    );
    imagesAdded = await prisma.previewImage.count({ where: { printId: print.id } });
  }

  let filesAdded = 0;
  let filesAlreadyPresent = 0;
  if (opts.files) {
    if (snapshot.makerworld) {
      // Each profile is its own 3MF with its own settings, so a missing one is a new file on the
      // model -- the same thing importing its link does.
      const cookie = await getUserMakerworldCookie(userId);
      const have = new Set(print.plates.map((plate) => plate.sourceInstanceId).filter(Boolean));
      for (const profileId of snapshot.makerworld.profileIds) {
        if (have.has(profileId)) {
          filesAlreadyPresent++;
          continue;
        }
        const profileUrl = `https://makerworld.com/en/models/${snapshot.makerworld.designId}#profileId-${profileId}`;
        const result = await importPrintFromUrl(userId, profileUrl, {
          url: profileUrl,
          makerworld_cookie: cookie,
          makerworldPaceMs: IMPORT_MAKERWORLD_CALL_DELAY_MS,
        });
        if (result.profileAdded) filesAdded++;
        else filesAlreadyPresent++;
      }
    } else {
      const plain = await addMissingPlainFiles(userId, print, print.plates, snapshot.fileDownloads);
      filesAdded = plain.added;
      filesAlreadyPresent = plain.alreadyPresent;
    }
  }

  return {
    source_url: sourceUrl,
    title_filled: metadata.title,
    notes_filled: metadata.notes,
    tags_added: metadata.tagsAdded,
    creator_filled: metadata.creator,
    author_linked: metadata.author,
    category_filled: metadata.category,
    files_added: filesAdded,
    files_already_present: filesAlreadyPresent,
    images_added: imagesAdded,
  };
}
