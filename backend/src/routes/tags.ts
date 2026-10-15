import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { normalizeTag } from "../utils/tagNormalization";
import { printCoverUrl } from "../dto";
import { addTagBookmark, listBookmarkedTagSet, removeTagBookmark } from "../services/bookmarkService";
import { createLog } from "../services/auditLog";
import { relocatePrintsForToken } from "../services/printService";
import { HttpError } from "../utils/fileUtils";

const router = Router();
router.use(requireAuth);

function sortedBookmarks(tags: Iterable<string>): string[] {
  return [...tags].toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Every tag in the library (unlike GET /tags, which follows the grid filter).

/** Pictures behind each tag's tile, from its newest models. */
const TAG_THUMBNAILS = 10;
/** Models looked at per tag for those pictures; more than ten, as some models have none yet. */
const TAG_THUMBNAIL_CANDIDATES = 30;

const summaryQuery = z.object({
  sort: z.enum(["popular", "name"]).catch("popular"),
  limit: z.coerce.number().int().min(1).max(100).catch(48),
  offset: z.coerce.number().int().min(0).catch(0),
  // Tags on fewer models are left out, so a page holds only what's shown.
  min_count: z.coerce.number().int().min(1).catch(1),
});

router.get(
  "/tags/summary",
  asyncHandler(async (req, res) => {
    const { sort, limit, offset, min_count: minCount } = summaryQuery.parse(req.query);
    const [prints, bookmarked] = await Promise.all([
      // Counting needs only the tags; pictures are joined below for this page's tags alone.
      prisma.print.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, tags: true },
      }),
      listBookmarkedTagSet(req.userId!),
    ]);
    const counts = new Map<string, number>();
    for (const print of prints) {
      for (const tag of new Set(print.tags.map(normalizeTag))) {
        if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const matching = [...counts.entries()]
      .filter(([, count]) => count >= minCount)
      .toSorted(([a, countA], [b, countB]) =>
        sort === "name"
          ? a.toLowerCase().localeCompare(b.toLowerCase())
          : countB - countA || a.toLowerCase().localeCompare(b.toLowerCase()),
      );
    const page = matching.slice(offset, offset + limit);

    // Each of this page's tags' newest models, then their first image and plate in one query.
    const candidates = new Map(page.map(([name]) => [name, [] as string[]]));
    for (const print of prints) {
      for (const tag of new Set(print.tags.map(normalizeTag))) {
        const ids = candidates.get(tag);
        if (ids && ids.length < TAG_THUMBNAIL_CANDIDATES) ids.push(print.id);
      }
    }
    const pictureRows = await prisma.print.findMany({
      where: { id: { in: [...new Set([...candidates.values()].flat())] } },
      select: {
        id: true,
        previewImages: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
        plates: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
      },
    });
    const pictureIds = new Map(pictureRows.map((row) => [row.id, row]));
    // A model under several of the page's tags is looked up on disk once.
    const covers = new Map<string, string | null>();
    const coverOf = (id: string) => {
      if (!covers.has(id)) {
        const row = pictureIds.get(id);
        covers.set(id, row ? printCoverUrl(row.previewImages[0]?.id ?? null, row.plates[0]?.id ?? null) : null);
      }
      return covers.get(id);
    };
    const thumbnails = new Map<string, string[]>();
    for (const [tag, ids] of candidates) {
      const pictures: string[] = [];
      // Stops at ten, so the rest of the candidates aren't looked up on disk.
      for (const id of ids) {
        if (pictures.length >= TAG_THUMBNAILS) break;
        const cover = coverOf(id);
        if (cover) pictures.push(cover);
      }
      thumbnails.set(tag, pictures);
    }

    res.json({
      items: page.map(([name, count]) => ({
        name,
        count,
        bookmarked: bookmarked.has(name),
        thumbnails: thumbnails.get(name) ?? [],
      })),
      total: matching.length,
      // Every tag, whatever its count: tells "none match the filter" from "no tags at all".
      total_all: counts.size,
      has_more: offset + page.length < matching.length,
    });
  }),
);

// Just the bookmarked names, without scanning every print like /tags/summary.

router.get(
  "/tags/bookmarked",
  asyncHandler(async (req, res) => {
    res.json(sortedBookmarks(await listBookmarkedTagSet(req.userId!)));
  }),
);

router.post(
  "/tags/:tag/bookmark",
  asyncHandler(async (req, res) => {
    await addTagBookmark(req.userId!, req.params.tag);
    res.json({ ok: true });
  }),
);

router.delete(
  "/tags/:tag/bookmark",
  asyncHandler(async (req, res) => {
    await removeTagBookmark(req.userId!, req.params.tag);
    res.json({ ok: true });
  }),
);

// Takes the tag off every model of the user's that has it, in whatever case it was saved.
router.delete(
  "/tags/:tag",
  asyncHandler(async (req, res) => {
    const tag = normalizeTag(req.params.tag);
    if (!tag) throw new HttpError(400, "Tag is required");
    const prints = await prisma.print.findMany({ where: { userId: req.userId }, select: { id: true, tags: true } });
    const tagged = prints.filter((print) => print.tags.some((other) => normalizeTag(other) === tag));
    await prisma.$transaction(
      tagged.map((print) =>
        prisma.print.update({
          where: { id: print.id },
          data: { tags: print.tags.filter((other) => normalizeTag(other) !== tag) },
        }),
      ),
    );
    await removeTagBookmark(req.userId!, tag);
    // Files only move when the storage template is laid out by tags.
    await relocatePrintsForToken(
      "tags",
      tagged.map((print) => print.id),
    );
    void createLog({ userId: req.userId!, action: "tag_deleted", details: { name: tag, models: tagged.length } });
    res.json({ models: tagged.length });
  }),
);

export default router;
