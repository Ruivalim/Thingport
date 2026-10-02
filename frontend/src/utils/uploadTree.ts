import { UnauthorizedError } from "../api/client";
import { categoriesApi, type Category } from "../api/categories";
import { printsApi, type Print } from "../api/prints";
import { MODEL_EXTS, UPLOAD_EXTS } from "../constants/fileTypes";

export type UploadEntry = {
  file: File;
  relativePath: string;
};

type FileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, error?: (err: unknown) => void) => void;
  createReader?: () => FileSystemDirectoryReader;
};

type FileSystemDirectoryReader = {
  readEntries: (success: (entries: FileSystemEntry[]) => void, error?: (err: unknown) => void) => void;
};

function normalizeRelativePath(path: string) {
  const trimmed = (path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  return trimmed || "";
}

export function entriesFromFileList(files: FileList | File[]): UploadEntry[] {
  return Array.from(files || []).map((file) => {
    const anyFile = file as File & { webkitRelativePath?: string };
    const relativePath = normalizeRelativePath(anyFile.webkitRelativePath || file.name);
    return { file, relativePath: relativePath || file.name };
  });
}

async function readAllEntries(reader: FileSystemDirectoryReader) {
  const entries: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    entries.push(...batch);
  }
  return entries;
}

async function traverseEntry(entry: FileSystemEntry, parentPath: string, output: UploadEntry[]) {
  const entryPath = normalizeRelativePath(parentPath ? `${parentPath}/${entry.name}` : entry.name);
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file?.(resolve, reject));
    output.push({ file, relativePath: entryPath || file.name });
    return;
  }
  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const entries = await readAllEntries(reader);
    await Promise.all(entries.map((child) => traverseEntry(child, entryPath, output)));
  }
}

export async function entriesFromDataTransfer(dataTransfer: DataTransfer): Promise<UploadEntry[]> {
  const output: UploadEntry[] = [];
  const items = Array.from(dataTransfer.items || []);
  const entryItems = items
    .map((item) => (item as unknown as { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.())
    .filter(Boolean) as FileSystemEntry[];

  if (entryItems.length) {
    await Promise.all(entryItems.map((entry) => traverseEntry(entry, "", output)));
    return output;
  }

  for (const item of items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;
    const anyFile = file as File & { webkitRelativePath?: string };
    const relativePath = normalizeRelativePath(anyFile.webkitRelativePath || file.name);
    output.push({ file, relativePath: relativePath || file.name });
  }

  if (!output.length) {
    return entriesFromFileList(dataTransfer.files || []);
  }
  return output;
}

/** Finds or creates the category path under `baseCategoryId`, one segment per level. */
function categoryResolver(baseCategoryId: string | null) {
  const cache = new Map<string, string>();
  // Folders reuse a same-named category in the same place, so uploading a tree twice doesn't duplicate it.
  let existing: Category[] | null = null;

  const child = async (parentId: string | null, key: string, name: string) => {
    const cached = cache.get(key);
    if (cached) return cached;
    existing ??= await categoriesApi.list();
    // At the top level only a folder is reused: uploaded folders shouldn't merge into a starter category.
    const match = existing.find(
      (c) => (c.parent_id ?? null) === parentId && c.name === name && (parentId || c.kind === "folder"),
    );
    const id = match ? match.id : ((await categoriesApi.create(name, [], parentId || undefined)) as { id: string }).id;
    cache.set(key, id);
    return id;
  };

  return async (segments: string[]) => {
    let categoryId = baseCategoryId;
    let key = baseCategoryId || "root";
    for (const segment of segments) {
      key = `${key}/${segment}`;
      categoryId = await child(categoryId, key, segment);
    }
    return categoryId;
  };
}

function splitPath(entry: UploadEntry) {
  const segments = normalizeRelativePath(entry.relativePath || entry.file.name)
    .split("/")
    .filter(Boolean);
  segments.pop();
  return segments;
}

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isModelFile(name: string) {
  return MODEL_EXTS.has(extOf(name));
}

// Larger images than the preview-image endpoint takes are attached to the model as files instead.
const PREVIEW_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "bmp"]);
const PREVIEW_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

// OS metadata a folder pick drags along, never meant as content.
const SYSTEM_FILES = new Set(["thumbs.db", "desktop.ini"]);

export function isSystemFile(name: string) {
  return name.startsWith(".") || SYSTEM_FILES.has(name.toLowerCase());
}

function isPreviewImage(file: File) {
  return PREVIEW_IMAGE_EXTS.has(extOf(file.name)) && file.size <= PREVIEW_IMAGE_MAX_BYTES;
}

/** True when some folder in the upload holds a model file, so the folder-as-model choice means something. */
export function hasModelFolders(entries: UploadEntry[]) {
  return entries.some((entry) => splitPath(entry).length > 0 && isModelFile(entry.file.name));
}

const byName = (a: UploadEntry, b: UploadEntry) =>
  a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: "base" });

function failureLabel(name: string, err: unknown) {
  const message = err instanceof Error ? err.message.trim() : "";
  return message && message !== "Upload failed" ? `${name} (${message})` : name;
}

export function uploadEntriesToCategory(
  entries: UploadEntry[],
  parentCategoryId: string | null,
  onUnauthorized?: () => void,
) {
  return uploadEach(entries, categoryResolver(parentCategoryId), onUnauthorized);
}

async function uploadEach(
  entries: UploadEntry[],
  resolveCategory: ReturnType<typeof categoryResolver>,
  onUnauthorized?: () => void,
) {
  const failed: string[] = [];
  let uploaded = 0;
  const uploadedEntries: UploadEntry[] = [];
  const prints: Print[] = [];

  // A folder pick isn't filtered by the file picker, so skip what couldn't become a model on its own.
  for (const entry of entries.filter((e) => UPLOAD_EXTS.includes(extOf(e.file.name)))) {
    try {
      const segments = splitPath(entry);
      let categoryId: string | null;
      try {
        categoryId = await resolveCategory(segments);
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        console.error("Category creation failed for", entry.relativePath, err);
        failed.push(entry.file.name);
        continue;
      }
      // Folder-tree leaves are always single-plate prints.
      const result = await printsApi.upload([entry.file], { category_id: categoryId || undefined });
      uploaded += 1;
      uploadedEntries.push(entry);
      prints.push(...result.prints);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
        break;
      }
      console.error("Upload failed for", entry.file.name, err);
      failed.push(failureLabel(entry.file.name, err));
    }
  }
  return { uploaded, failed, uploadedEntries, prints };
}

/**
 * Each folder that directly holds model files becomes one model named after the folder: its model files
 * are the plates, its images the preview images, anything else is attached. The folders above it become
 * categories; files outside any model folder upload one model each, as usual.
 */
export async function uploadFoldersAsModels(
  entries: UploadEntry[],
  parentCategoryId: string | null,
  onUnauthorized?: () => void,
) {
  const groups = new Map<string, { segments: string[]; entries: UploadEntry[] }>();
  for (const entry of entries) {
    const segments = splitPath(entry);
    const key = segments.join("/");
    const group = groups.get(key) ?? { segments, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }

  const modelGroups = [...groups.values()].filter(
    (g) => g.segments.length > 0 && g.entries.some((e) => isModelFile(e.file.name)),
  );
  const rest = [...groups.values()].filter((g) => !modelGroups.includes(g)).flatMap((g) => g.entries);

  const failed: string[] = [];
  let uploaded = 0;
  const uploadedEntries: UploadEntry[] = [];
  const prints: Print[] = [];
  const resolveCategory = categoryResolver(parentCategoryId);

  for (const group of modelGroups) {
    const folderName = group.segments[group.segments.length - 1];
    const sorted = group.entries.toSorted(byName);
    const images = sorted.filter((e) => isPreviewImage(e.file));
    const files = sorted.filter((e) => !isPreviewImage(e.file));
    try {
      let categoryId: string | null;
      try {
        categoryId = await resolveCategory(group.segments.slice(0, -1));
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        console.error("Category creation failed for", group.segments.join("/"), err);
        failed.push(folderName);
        continue;
      }
      const result = await printsApi.upload(
        files.map((e) => e.file),
        { title: folderName, category_id: categoryId || undefined, mode: "multiplate" },
      );
      uploaded += 1;
      uploadedEntries.push(...files);
      let print = result.prints[0];
      if (print && images.length) {
        try {
          print = (
            await printsApi.addPreviewImages(
              print.id,
              images.map((e) => e.file),
            )
          ).print;
          uploadedEntries.push(...images);
        } catch (err) {
          if (err instanceof UnauthorizedError) throw err;
          console.error("Preview images failed for", folderName, err);
          failed.push(failureLabel(`${folderName} (images)`, err));
        }
      }
      if (print) prints.push(print);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
        return { uploaded, failed, uploadedEntries, prints };
      }
      console.error("Upload failed for", folderName, err);
      failed.push(failureLabel(folderName, err));
    }
  }

  if (rest.length) {
    const result = await uploadEach(rest, resolveCategory, onUnauthorized);
    uploaded += result.uploaded;
    failed.push(...result.failed);
    uploadedEntries.push(...result.uploadedEntries);
    prints.push(...result.prints);
  }
  return { uploaded, failed, uploadedEntries, prints };
}
