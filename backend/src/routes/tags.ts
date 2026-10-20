import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { normalizeTag } from "../utils/tagNormalization";
import { addTagBookmark, listBookmarkedTagSet, removeTagBookmark } from "../services/bookmarkService";
import { createLog } from "../services/auditLog";
import { relocatePrintsForToken } from "../services/printService";
import { HttpError } from "../utils/fileUtils";
import {
  ensureTagMosaic,
  listTaggedPrints,
  removeTagMosaics,
  tagMosaicUrl,
  tagPictures,
  type MosaicKind,
} from "../services/tagMosaicService";

const router = Router();
router.use(requireAuth);

function sortedBookmarks(tags: Iterable<string>): string[] {
  return [...tags].toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Every tag in the library (unlike GET /tags, which follows the grid filter).

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
    const [prints, bookmarked] = await Promise.all([listTaggedPrints(req.userId!), listBookmarkedTagSet(req.userId!)]);
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

    // Pictures for this page's tags alone, joined in one query; the browser picks which mosaic to show.
    const pictures = await tagPictures(
      prints,
      page.map(([name]) => name),
      ["images", "renders"],
    );

    res.json({
      items: page.map(([name, count]) => ({
        name,
        count,
        bookmarked: bookmarked.has(name),
        mosaic_url: tagMosaicUrl(name, pictures.get("images")?.get(name) ?? []),
        render_mosaic_url: tagMosaicUrl(name, pictures.get("renders")?.get(name) ?? [], "renders"),
      })),
      total: matching.length,
      // Every tag, whatever its count: tells "none match the filter" from "no tags at all".
      total_all: counts.size,
      has_more: offset + page.length < matching.length,
    });
  }),
);

// The tag's tile picture; its URL carries a version, so it's cached for good and asked for anew when it changes.
function mosaicHandler(kind: MosaicKind) {
  return asyncHandler(async (req, res) => {
    const file = await ensureTagMosaic(req.userId!, req.params.tag, kind);
    if (!file) throw new HttpError(404, "Not found");
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.sendFile(file);
  });
}
router.get("/tags/:tag/mosaic.webp", mosaicHandler("images"));
router.get("/tags/:tag/render-mosaic.webp", mosaicHandler("renders"));

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
    await removeTagMosaics(req.userId!, tag);
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
