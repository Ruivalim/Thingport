// Content script entry point (MakerWorld, Thingiverse, Printables). Network calls go through the
// background (see runtime.ts).

import type { ImportStatus } from "../shared/api";
import { listen, send, type ContentMessages } from "../shared/messages";
import { CONFIG_CHANGE_KEYS } from "../shared/storage";
import { classifyUrl } from "../shared/urls";
import { setContext, type LibraryState } from "./context";
import { isMakerworldBlockingError, resolveMakerworldDownloadUrl } from "./makerworld/downloadResolver";
import { offerNormalizedDownload, unmountNormalizedDownload } from "./makerworld/normalizedDownload";
import { mountJobOverlay, mountPausedJobOverlay } from "./overlays";
import { loadPanel } from "./panels";
import { errorHtml } from "./panels/results";
import { api } from "./runtime";
import { closeSetupModal, openSetupModal } from "./setupModal";
import { mountFab, mountHost, mountPanel, renderPanel, setPanelOpen, unmountHost } from "./shell";

declare global {
  interface Window {
    thingportGrabInjected?: boolean;
  }
}

// Bumped on every re-init so stale in-flight checks don't mount an icon for the wrong URL.
let initToken = 0;

function reportTabIconState(active: boolean): void {
  void send("SET_TAB_ICON_STATE", { active });
}

function unmount(): void {
  closeSetupModal();
  unmountNormalizedDownload();
  unmountHost();
  setContext(null);
}

async function init(): Promise<void> {
  const myToken = ++initToken;
  const isStale = () => myToken !== initToken;

  // A guided collection import takes over the whole page.
  const jobRes = await send("GET_MAKERWORLD_JOB");
  if (isStale()) return;
  if (jobRes?.ok && jobRes.data.job) {
    const job = jobRes.data.job;
    if (job.paused) mountPausedJobOverlay(mountHost(), job);
    else mountJobOverlay(mountHost(), job);
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

  if (classification.provider === "makerworld" && classification.kind === "single") {
    void offerNormalizedDownload(url, stateRes.data.configured, isStale);
  }

  // Not set up: still show a grayed-out icon on importable pages so the extension is discoverable.
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
      // Show the icon anyway; the panel surfaces the real error.
    }
  }
  if (isStale()) return;

  setContext({
    url,
    instanceUrl: stateRes.data.instanceUrl,
    classification,
    library,
    canQueue: stateRes.data.isAdmin,
  });
  const root = mountHost();
  const togglePanel = mountPanel(root, () => void loadPanel());
  mountFab(root, {
    variant: library ? "in-library" : undefined,
    label: library ? "Add this print profile to Thingport" : "Import to Thingport",
    onClick: togglePanel,
  });
  reportTabIconState(true);

  // A guided import that stopped early lands back here, so show why.
  if (jobRes?.ok && jobRes.data.error) {
    const { message, imported, total } = jobRes.data.error;
    setPanelOpen(true);
    renderPanel(errorHtml(new Error(`Guided import stopped after ${imported} of ${total} models: ${message}`)));
  }
}

// All three sites are SPAs, so this script runs once per tab. Patch pushState/replaceState, listen
// for popstate, and poll as a safety net.
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !CONFIG_CHANGE_KEYS.some((key) => key in changes)) return;
    unmount();
    void init();
  });

  listen<ContentMessages>({
    // A CAPTCHA or the daily download limit comes back as an error reply so the guided import can
    // say so.
    RESOLVE_MAKERWORLD_DOWNLOAD_URL: () =>
      resolveMakerworldDownloadUrl(location.href).catch((err) => {
        if (isMakerworldBlockingError(err)) throw err;
        return null;
      }),
    MAKERWORLD_JOB_UPDATED: () => {
      unmount();
      void init();
      return null;
    },
  });

  installNavigationWatcher();
  void init();
}
