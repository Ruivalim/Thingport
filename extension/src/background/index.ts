// Background entry point (a service worker in Chrome/Edge, an event page in Firefox -- see
// scripts/manifest.ts). Owns the extension's config/auth state and every request to the user's
// Thingport instance; the content script and popup only ever talk to it through the typed
// messages in shared/messages.ts.

import { listen, type BackgroundMessages } from "../shared/messages";
import { apiCall } from "./api";
import { getState, saveConfig, setDisabled } from "./config";
import { armDownloadCapture, awaitDownloadCapture } from "./downloadCapture";
import { importSingle } from "./importJobs";
import { abortJob, advanceJob, dropJobIfForTab, forceAdvanceJob, getJobForTab, startJob } from "./makerworldJob";
import { getRecentImports } from "./recentImports";
import { openSetup } from "./setup";
import { setTabIconState } from "./tabIcon";

/** Messages that only make sense from a content script (they act on the sender's tab). */
function senderTabId(sender: chrome.runtime.MessageSender): number {
  if (!sender.tab?.id) throw new Error("This action is only available from a page");
  return sender.tab.id;
}

listen<BackgroundMessages>({
  GET_STATE: () => getState(),
  SAVE_CONFIG: (payload) => saveConfig(payload),
  SET_DISABLED: ({ disabled }) => setDisabled(disabled),
  GET_RECENT_IMPORTS: () => getRecentImports(),
  OPEN_SETUP: (_payload, sender) => openSetup(sender.tab?.id),
  SET_TAB_ICON_STATE: ({ active }, sender) => setTabIconState(senderTabId(sender), active),
  API_CALL: ({ method, path, body }) => apiCall(method, path, body),
  IMPORT_SINGLE: (payload) => importSingle(payload),
  START_MAKERWORLD_COLLECTION_JOB: (payload, sender) => startJob(senderTabId(sender), payload),
  ABORT_MAKERWORLD_COLLECTION_JOB: (_payload, sender) => abortJob(senderTabId(sender)),
  FORCE_ADVANCE_MAKERWORLD_JOB: (_payload, sender) => forceAdvanceJob(senderTabId(sender)),
  ARM_DOWNLOAD_CAPTURE: () => armDownloadCapture(),
  AWAIT_DOWNLOAD_CAPTURE: () => awaitDownloadCapture(),
  GET_MAKERWORLD_JOB: (_payload, sender) => getJobForTab(sender.tab?.id),
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // The moment a tab starts a NEW navigation (including to a site this extension never runs on),
  // reset its icon to inactive -- a per-tab setIcon override otherwise persists until something
  // changes it. If the destination is a provider page, its content script re-asserts the right
  // state a moment later.
  if (changeInfo.status === "loading") void setTabIconState(tabId, false);
  // Drives the guided MakerWorld collection import -- "complete" is what wakes the background back
  // up even if it was suspended between steps.
  if (changeInfo.status === "complete") void advanceJob(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void dropJobIfForTab(tabId);
});
