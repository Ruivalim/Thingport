import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { HttpError } from "../utils/fileUtils";
import { asyncHandler } from "../utils/asyncHandler";
import { toAuthorOut, toUserOut } from "../dto";
import { getLinkedAuthorsForUser, isAuthorLinked, linkAuthorToUser } from "../services/authorService";

const router = Router();
router.use(requireAuth);

// Authors are shared across users, so there's no ownership check.
router.get(
  "/author/:id",
  asyncHandler(async (req, res) => {
    const author = await prisma.author.findUnique({ where: { id: req.params.id } });
    if (!author) throw new HttpError(404, "Author not found");
    res.json(toAuthorOut(author, await isAuthorLinked(author.id)));
  }),
);

router.get(
  "/me/author-links",
  asyncHandler(async (req, res) => {
    const authors = await getLinkedAuthorsForUser(req.userId!);
    res.json(authors.map((a) => toAuthorOut(a, true)));
  }),
);

router.post(
  "/author/:id/link",
  asyncHandler(async (req, res) => {
    const { author, user } = await linkAuthorToUser(req.userId!, req.params.id);
    res.json({ author: toAuthorOut(author, true), user: toUserOut(user) });
  }),
);

export default router;
