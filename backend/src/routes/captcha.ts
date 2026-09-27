import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { createCaptcha } from "../services/captchaService";
import { getCaptchaSettings } from "../services/settingsService";

const router = Router();

// Public: the sign-in and register forms need one before anyone is logged in. Only the image and
// its id leave the server -- the answer stays in captchaService's memory.
router.get(
  "/captcha",
  asyncHandler(async (_req, res) => {
    const { id, image } = createCaptcha();
    res.set("Cache-Control", "no-store");
    res.json({ id, image });
  }),
);

// Where the web app has to ask for a captcha -- also public, for the same reason. Changed by admins
// through PATCH /settings/captcha.
router.get(
  "/captcha/settings",
  asyncHandler(async (_req, res) => {
    res.json(await getCaptchaSettings());
  }),
);

export default router;
