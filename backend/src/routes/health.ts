import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../db";
import { getAllowRegistrations } from "../services/settingsService";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    // Whether the sign-in page offers a Register tab. Always true until the first admin exists --
    // that first account can register whatever the setting says (see routes/auth.ts).
    const bootstrapping = (await prisma.user.count({ where: { role: "ADMIN" } })) === 0;
    res.json({ ok: true, auth_required: true, allow_registrations: bootstrapping || (await getAllowRegistrations(true)) });
  }),
);

export default router;
