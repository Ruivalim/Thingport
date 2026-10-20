import type { Cults3dSettings } from "../../../api/settings";

// Cults3D is connected in two parts: the API key reads models and lists, and the browser's sign-in, which Thingport
// Grab sends, downloads the files. Both are needed for an import.

/** Whether both parts are there and neither was turned down. */
export function cults3dReady(settings: Cults3dSettings | null): boolean {
  return Boolean(settings?.configured && !settings.expired && settings.session_configured && !settings.session_expired);
}

/** What's missing, most basic first; undefined when nothing is. */
export function cults3dStatus(settings: Cults3dSettings | null, t: (key: string) => string): string | undefined {
  if (!settings?.configured) return t("userMenu.cults3dDisabledReason");
  if (settings.expired) return t("providers.cults3d.expired");
  if (!settings.session_configured) return t("providers.cults3d.siteMissing");
  if (settings.session_expired) return t("providers.cults3d.siteExpired");
  return undefined;
}
