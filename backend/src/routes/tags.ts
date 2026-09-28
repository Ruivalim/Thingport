import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { normalizeTag } from "../utils/tagNormalization";
import { addTagBookmark, listBookmarkedTagSet, removeTagBookmark } from "../services/bookmarkService";

const router = Router();
router.use(requireAuth);

function sortedBookmarks(tags: Iterable<string>): string[] {
  return [...tags].toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Every tag in the library (unlike GET /tags, which follows the grid filter).

const sortSchema = z.enum(["popular", "name"]).catch("popular");

router.get(
  "/tags/summary",
  asyncHandler(async (req, res) => {
    const sort = sortSchema.parse(req.query.sort);
    const [prints, bookmarked] = await Promise.all([
      prisma.print.findMany({ where: { userId: req.userId }, select: { tags: true } }),
      listBookmarkedTagSet(req.userId!),
    ]);
    const counts = new Map<string, number>();
    for (const print of prints) {
      for (const tag of print.tags) {
        const cleaned = normalizeTag(tag);
        if (!cleaned) continue;
        counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
      }
    }
    const tags = [...counts.entries()]
      .map(([name, count]) => ({ name, count, bookmarked: bookmarked.has(name) }))
      .toSorted((a, b) =>
        sort === "name"
          ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          : b.count - a.count || a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    res.json(tags);
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

export default router;
