import { Router } from "express";
import { requireAuth } from "../auth";
import { asyncHandler } from "../utils/asyncHandler";
import { search } from "../services/searchService";

const router = Router();
router.use(requireAuth);

// A blank `q` returns empty results.
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    res.json(await search(req.userId!, q));
  }),
);

export default router;
