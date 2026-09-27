import { authHeaders } from "../utils/auth";
import { apiBase, assertOk, readErrorMessage, UnauthorizedError } from "./client";

/** Where the web app asks for a captcha (Administration > Captcha). */
export type CaptchaPlace = "login" | "register" | "import";
export type CaptchaSettings = Record<CaptchaPlace, boolean>;

/** A solved captcha, sent along with the request it guards. */
export type CaptchaAnswer = { captcha_id: string; captcha_answer: string };

export const captchaApi = {
  /** A fresh captcha image. Each one works once and expires after 10 minutes. */
  get: async (): Promise<{ id: string; image: string }> => {
    const res = await fetch(`${apiBase()}/captcha`, { cache: "no-store" });
    assertOk(res, "Failed to load the captcha");
    return res.json();
  },

  getSettings: async (): Promise<CaptchaSettings> => {
    const res = await fetch(`${apiBase()}/captcha/settings`);
    assertOk(res, "Failed to load captcha settings");
    return res.json();
  },

  updateSettings: async (patch: Partial<CaptchaSettings>): Promise<CaptchaSettings> => {
    const res = await fetch(`${apiBase()}/settings/captcha`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to update captcha settings"));
    return res.json();
  },
};
