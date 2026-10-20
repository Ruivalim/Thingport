import { prisma } from "../db";
import { HttpError } from "../utils/fileUtils";
import { normalizeTag } from "../utils/tagNormalization";
import { moveTagBookmark, removeTagBookmark } from "./bookmarkService";
import { relocatePrintsForToken } from "./printService";
import { listTaggedPrints, removeTagMosaics } from "./tagMosaicService";

function normalizedSet(tags: string[]): Set<string> {
  const set = new Set(tags.map(normalizeTag));
  set.delete("");
  if (!set.size) throw new HttpError(400, "Tag is required");
  return set;
}

/** `tags` with each of `from` swapped for `to`, or dropped without one, and no tag twice. Saved case is kept for the
 *  rest, as tags saved before normalization may vary. */
function rewrite(tags: string[], from: Set<string>, to: string | null): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const next = from.has(normalizeTag(tag)) ? to : tag;
    if (!next || seen.has(normalizeTag(next))) continue;
    seen.add(normalizeTag(next));
    result.push(next);
  }
  return result;
}

/** Swaps `from` for `to` (or removes them) on every model and collection of the user's, in one transaction so two
 *  rewrites can't each save a model's tags over the other's. Answers how many models had each of `from`, the models
 *  changed, and how many of those hadn't had `to`. */
async function rewriteTags(
  userId: string,
  from: Set<string>,
  to: string | null,
): Promise<{ counts: Map<string, number>; printIds: string[]; gained: number }> {
  const [prints, collections] = await Promise.all([
    prisma.print.findMany({ where: { userId }, select: { id: true, tags: true } }),
    prisma.collection.findMany({ where: { userId }, select: { id: true, tags: true } }),
  ]);
  const counts = new Map([...from].map((tag) => [tag, 0]));
  let gained = 0;
  const tagged = prints.filter((print) => {
    const own = new Set(print.tags.map(normalizeTag));
    for (const tag of from) if (own.has(tag)) counts.set(tag, counts.get(tag)! + 1);
    const hit = [...from].some((tag) => own.has(tag));
    if (hit && to && !own.has(to)) gained++;
    return hit;
  });
  const taggedCollections = collections.filter((c) => c.tags.some((tag) => from.has(normalizeTag(tag))));
  await prisma.$transaction([
    ...tagged.map((print) =>
      prisma.print.update({ where: { id: print.id }, data: { tags: rewrite(print.tags, from, to) } }),
    ),
    ...taggedCollections.map((c) =>
      prisma.collection.update({ where: { id: c.id }, data: { tags: rewrite(c.tags, from, to) } }),
    ),
  ]);
  return { counts, printIds: tagged.map((print) => print.id), gained };
}

/** Takes the tags off every model and collection that has them, with their bookmarks and tile pictures. Answers how
 *  many models had each. */
export async function deleteTags(userId: string, tags: string[]): Promise<Map<string, number>> {
  const from = normalizedSet(tags);
  const { counts, printIds } = await rewriteTags(userId, from, null);
  for (const tag of from) {
    await removeTagBookmark(userId, tag);
    await removeTagMosaics(userId, tag);
  }
  // Files only move when the storage template is laid out by tags.
  await relocatePrintsForToken("tags", printIds);
  return counts;
}

/** How many models would carry the merged tag: every model with any of `tags`, once. The same whichever one is kept. */
export async function previewTagMerge(userId: string, tags: string[]): Promise<{ models: number }> {
  const wanted = normalizedSet(tags);
  const prints = await listTaggedPrints(userId);
  return { models: prints.filter((print) => print.tags.some((tag) => wanted.has(normalizeTag(tag)))).length };
}

/** Puts `primary` in place of each of the others on every model and collection, then removes the others; `primary`
 *  takes over a bookmark if it had none. Answers the others, and how many models gained `primary`. */
export async function mergeTags(
  userId: string,
  primaryTag: string,
  tags: string[],
): Promise<{ primary: string; merged: string[]; added: number }> {
  const primary = normalizeTag(primaryTag);
  if (!primary) throw new HttpError(400, "Tag is required");
  const from = normalizedSet(tags);
  from.delete(primary);
  if (!from.size) throw new HttpError(400, "Pick at least one other tag to merge");

  const { printIds, gained } = await rewriteTags(userId, from, primary);
  await moveTagBookmark(userId, [...from], primary);
  for (const tag of from) await removeTagMosaics(userId, tag);
  await relocatePrintsForToken("tags", printIds);
  return { primary, merged: [...from], added: gained };
}
