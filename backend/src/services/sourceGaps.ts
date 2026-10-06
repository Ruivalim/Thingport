import type { PreviewImage, Print } from "@prisma/client";

// What "Fetch missing details" can fill from an imported model's source. Files and print
// profiles aren't gaps: which ones a model holds is the user's choice at import.
export const SOURCE_GAPS = ["title", "description", "tags", "creator", "author", "category", "images"] as const;
export type SourceGap = (typeof SOURCE_GAPS)[number];

type GapFields = Pick<
  Print,
  "title" | "notes" | "tags" | "creator" | "authorId" | "categoryId" | "sourceProvider" | "sourceExternalId"
>;

/** Read off the model alone, never the source, so it's cheap enough for every page load. */
export function emptyGaps(print: GapFields, previewImages: Pick<PreviewImage, "generated">[]): SourceGap[] {
  const gaps: SourceGap[] = [];
  if (!print.title?.trim()) gaps.push("title");
  if (!print.notes?.trim()) gaps.push("description");
  if (!print.tags.length) gaps.push("tags");
  if (!print.creator?.trim()) gaps.push("creator");
  if (!print.authorId) gaps.push("author");
  if (!print.categoryId) gaps.push("category");
  // Only our own 3D renders count as empty; an import's images replace them.
  if (previewImages.every((image) => image.generated)) gaps.push("images");
  return gaps;
}

/** The gaps worth offering a fill for: a model with a source, minus what its source already
 *  turned out not to have. */
export function openSourceGaps(
  print: GapFields & Pick<Print, "unfillableGaps">,
  previewImages: Pick<PreviewImage, "generated">[],
): SourceGap[] {
  if (!print.sourceProvider || !print.sourceExternalId) return [];
  const unfillable = new Set(print.unfillableGaps);
  return emptyGaps(print, previewImages).filter((gap) => !unfillable.has(gap));
}
