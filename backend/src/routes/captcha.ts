import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { createCaptcha } from "../services/captchaService";
import { getCaptchaSettings } from "../services/settingsService";

const router = Router();

// Public: the sign-in and register forms need it. The answer never leaves the server.
router.get(
  "/captcha",
  asyncHandler(async (_req, res) => {
    const { id, image } = createCaptcha();
    res.set("Cache-Control", "no-store");
    res.json({ id, image });
  }),
);

// Public for the same reason.
router.get(
  "/captcha/settings",
  asyncHandler(async (_req, res) => {
    res.json(await getCaptchaSettings());
  }),
);

export default router;
