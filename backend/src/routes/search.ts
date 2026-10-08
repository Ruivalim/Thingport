import { Router } from "express";
import { requireAuth } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { search } from "../services/searchService";

const router = Router();
router.use(requireAuth);

const MAX_LIMIT = 25;

// A blank `q` returns empty results. `limit` raises how many models and collections come back, for
// clients that show more than the search palette (or want to know if there are more).
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Number.parseInt(typeof req.query.limit === "string" ? req.query.limit : "", 10);
    res.json(
      await search(req.userId!, q, Number.isFinite(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : undefined),
    );
  }),
);

export default router;
