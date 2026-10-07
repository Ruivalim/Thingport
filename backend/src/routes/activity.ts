import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { parseBody } from "../utils/validate";
import { getActivity, getActivityMonth, safeTimeZone } from "../services/activityService";

const router = Router();
router.use(requireAuth);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const activityQuery = z.object({
  from: z.string().regex(DATE),
  to: z.string().regex(DATE),
  tz: z.string().max(64).optional(),
});

router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const query = parseBody(activityQuery, req.query);
    res.json(await getActivity(req.userId!, query.from, query.to, safeTimeZone(query.tz)));
  }),
);

const feedQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  until: z.string().regex(DATE).optional(),
  tz: z.string().max(64).optional(),
});

router.get(
  "/activity/feed",
  asyncHandler(async (req, res) => {
    const query = parseBody(feedQuery, req.query);
    const { groups, nextMonth } = await getActivityMonth(req.userId!, query.month, safeTimeZone(query.tz), query.until);
    res.json({
      month: query.month,
      groups: groups.map((group) => ({
        kind: group.kind,
        total: group.total,
        items: group.items.map((item) => ({
          print_id: item.printId,
          name: item.name,
          thumb_url: item.thumbUrl,
          exists: item.exists,
          count: item.count,
          last_at: item.lastAt.toISOString(),
        })),
      })),
      next_month: nextMonth,
    });
  }),
);

export default router;
