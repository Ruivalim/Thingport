// "More sites": a one-time button, shown while some site Grab supports isn't allowed yet. It asks the browser for
// access to all sites, so later ones need no new prompt; registering Grab there follows in the background, from the
// browser's permission event. It comes back only if that access is taken back.

import { ALL_SITES_ORIGINS, sitesWithoutAccess } from "../shared/optionalSites";
import { clearError, els, showError } from "./dom";

const LEAVE_MS = 200;

function listNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function hideSection(): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  els.sitesSection.classList.add("sites--leaving");
  window.setTimeout(
    () => {
      els.sitesSection.hidden = true;
      els.sitesSection.classList.remove("sites--leaving");
    },
    reduced ? 0 : LEAVE_MS,
  );
}

export async function loadSites(): Promise<void> {
  const missing = await sitesWithoutAccess();
  els.sitesSection.hidden = missing.length === 0;
  els.sitesText.textContent = `Use Thingport Grab on ${listNames(missing.map((site) => site.name))} too, and on sites added in later updates.`;
}

els.sitesBtn.addEventListener("click", async () => {
  clearError(els.configuredError);
  els.sitesBtn.disabled = true;
  try {
    // Straight away: permissions.request() needs this click's user gesture.
    if (await chrome.permissions.request({ origins: ALL_SITES_ORIGINS })) hideSection();
    else showError("Thingport Grab needs your browser's permission to run on these sites.", els.configuredError);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err), els.configuredError);
  } finally {
    els.sitesBtn.disabled = false;
  }
});
