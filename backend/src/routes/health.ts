import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../db";
import { getAllowRegistrations, isSmtpConfigured } from "../services/settingsService";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    // The first admin can always register, whatever the setting says.
    const bootstrapping = (await prisma.user.count({ where: { role: "ADMIN" } })) === 0;
    res.json({
      ok: true,
      auth_required: true,
      allow_registrations: bootstrapping || (await getAllowRegistrations(true)),
      // The reset link is emailed, so the sign-in form only offers it with SMTP set up.
      password_reset_enabled: await isSmtpConfigured(),
    });
  }),
);

export default router;
