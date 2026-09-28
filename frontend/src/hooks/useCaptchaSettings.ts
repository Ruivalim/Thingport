import React from "react";
import { captchaApi, type CaptchaSettings } from "../api/captcha";

// Fetched once per page load.
let cached: Promise<CaptchaSettings> | null = null;

/** Null until known. A failed fetch counts as "off"; the backend still enforces the real setting. */
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

export function invalidateCaptchaSettings(): void {
  cached = null;
}
