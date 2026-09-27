import React from "react";
import { captchaApi, type CaptchaSettings } from "../api/captcha";

// Fetched once per page load and shared by every form that may need a captcha. An admin who
// changes the settings sees them apply on the next load, same as other instance-wide settings.
let cached: Promise<CaptchaSettings> | null = null;

/** Whether each place asks for a captcha; null until known. A failed fetch counts as "off" --
 *  the backend still enforces the real setting, and its error then says what's missing. */
export function useCaptchaSettings(): CaptchaSettings | null {
  const [settings, setSettings] = React.useState<CaptchaSettings | null>(null);
  React.useEffect(() => {
    let active = true;
    cached ??= captchaApi.getSettings().catch(() => {
      cached = null;
      return { login: false, register: false, import: false };
    });
    void cached.then((value) => { if (active) setSettings(value); });
    return () => { active = false; };
  }, []);
  return settings;
}

/** Forgets the cached settings -- after an admin changes them in this same browser session. */
export function invalidateCaptchaSettings(): void {
  cached = null;
}
