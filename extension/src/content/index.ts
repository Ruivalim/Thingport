// Content script entry point (runs on MakerWorld, Thingiverse and Printables). Decides whether the
// current page gets the floating icon, and in which state; every network call goes through the
// background (see runtime.ts). The panel flows live in panels/, the in-page shell in shell.ts.

import type { ImportStatus } from "../shared/api";
import { listen, send, type ContentMessages } from "../shared/messages";
import { CONFIG_CHANGE_KEYS } from "../shared/storage";
import { classifyUrl } from "../shared/urls";
import { setContext, type LibraryState } from "./context";
import { resolveMakerworldDownloadUrl } from "./makerworld/downloadResolver";
import { mountJobOverlay } from "./overlays";
import { loadPanel } from "./panels";
import { errorHtml } from "./panels/results";
import { api } from "./runtime";
import { closeSetupModal, openSetupModal } from "./setupModal";
import { mountFab, mountHost, mountPanel, renderPanel, setPanelOpen, unmountHost } from "./shell";

declare global {
  interface Window {
    /** Guards against a second injection of this script into the same page. */
    thingportGrabInjected?: boolean;
  }
}

// Bumped on every re-init so a status check/mount still in flight for a page the user has already
// navigated away from discards its result instead of mounting a stale icon for the wrong URL.
let initToken = 0;

function reportTabIconState(active: boolean): void {
  void send("SET_TAB_ICON_STATE", { active });
}

function unmount(): void {
  closeSetupModal();
  unmountHost();
  setContext(null);
}

async function init(): Promise<void> {
  const myToken = ++initToken;
  const isStale = () => myToken !== initToken;

  // A guided MakerWorld collection import in progress for this tab takes over the whole page, on
  // every model page it visits -- checked first, since none of the normal detection applies then.
  const jobRes = await send("GET_MAKERWORLD_JOB");
  if (isStale()) return;
  if (jobRes?.ok && jobRes.data.job) {
    mountJobOverlay(mountHost(), jobRes.data.job);
    reportTabIconState(true);
    return;
  }

  const stateRes = await send("GET_STATE");
  if (isStale()) return;
  if (!stateRes?.ok || stateRes.data.disabled) {
    reportTabIconState(false);
    return;
  }

  const url = location.href;
  const classification = classifyUrl(url);
  if (!classification) {
    reportTabIconState(false);
    return;
  }

  // Not set up yet: still show the icon on a page it could import from, grayed out, so the
  // extension is discoverable where it matters -- clicking it explains what's missing and offers
  // the setup form. The toolbar icon stays inactive until it's configured.
  if (!stateRes.data.configured) {
    const root = mountHost();
    mountFab(root, {
      variant: "inactive",
      label: "Set up Thingport Grab to import this",
      title: "Thingport Grab isn't set up yet",
      onClick: () => openSetupModal(root),
    });
    reportTabIconState(false);
    return;
  }

  let library: LibraryState | null = null;
  if (classification.kind === "single") {
    try {
      const status = await api<ImportStatus>("GET", `/import/status?url=${encodeURIComponent(url)}`);
      if (isStale()) return;
      if (status.already_imported) {
        reportTabIconState(false);
        return;
      }
      if (status.state === "profile_missing" || status.state === "profile_unknown") {
        library = { state: status.state, printId: status.print_id ?? null };
      }
    } catch {
      // If the status check fails (instance unreachable, bad credentials, etc.) still show the
      // icon -- the panel's own error state surfaces the real problem when they try it.
    }
  }
  if (isStale()) return;

  setContext({ url, instanceUrl: stateRes.data.instanceUrl, classification, library });
  const root = mountHost();
  const togglePanel = mountPanel(root, () => void loadPanel());
  mountFab(root, {
    variant: library ? "in-library" : undefined,
    label: library ? "Add this print profile to Thingport" : "Import to Thingport",
    onClick: togglePanel,
  });
  reportTabIconState(true);

  // A guided import that just stopped early always lands back here, on the collection page it
  // started from -- surface why immediately rather than leaving the user to wonder.
  if (jobRes?.ok && jobRes.data.error) {
    const { message, imported, total } = jobRes.data.error;
    setPanelOpen(true);
    renderPanel(errorHtml(new Error(`Guided import stopped after ${imported} of ${total} models: ${message}`)));
  }
}

// MakerWorld, Printables and Thingiverse are client-side-routed SPAs -- moving from one model to
// another changes location.href without a page load, so this script runs once per *tab*, not per
// page. Patching history.pushState/replaceState covers every History-API router (all three);
// popstate covers back/forward; the interval is a cheap safety net for anything bypassing both.
function installNavigationWatcher(): void {
  let lastHref = location.href;
  const onLocationChange = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    unmount();
    void init();
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      onLocationChange();
      return result;
    };
  }
  window.addEventListener("popstate", onLocationChange);
  setInterval(onLocationChange, 1000);
}

if (!window.thingportGrabInjected) {
  window.thingportGrabInjected = true;

  // Re-evaluate immediately when the setup is saved, the instance changes, or "Extension enabled"
  // is flipped in the popup -- otherwise the icon would only catch up on the next navigation.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !CONFIG_CHANGE_KEYS.some((key) => key in changes)) return;
    unmount();
    void init();
  });

  // The guided MakerWorld collection import (background/makerworldJob.ts) asks the page it just
  // navigated to for the model's download URL -- resolving it here, from the live page, is what
  // keeps that back-to-back loop from tripping MakerWorld's CAPTCHA.
  listen<ContentMessages>({
    RESOLVE_MAKERWORLD_DOWNLOAD_URL: () => resolveMakerworldDownloadUrl(location.href).catch(() => null),
  });

  installNavigationWatcher();
  void init();
}
