// Background entry point (service worker in Chrome/Edge, event page in Firefox). Owns config, auth
// and every request to the Thingport instance.

import { listen, type BackgroundMessages } from "../shared/messages";
import { apiCall } from "./api";
import { getState, saveConfig, setDisabled } from "./config";
import { armDownloadCapture, awaitDownloadCapture } from "./downloadCapture";
import { importSingle } from "./importJobs";
import { abortJob, advanceJob, dropJobIfForTab, forceAdvanceJob, getJobForTab, startJob } from "./makerworldJob";
import { getRecentImports } from "./recentImports";
import { openSetup } from "./setup";
import { setTabIconState } from "./tabIcon";

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
  // Per-tab icon overrides persist, so reset on every new navigation; the content script re-asserts it.
  if (changeInfo.status === "loading") void setTabIconState(tabId, false);
  // "complete" wakes a suspended background to drive the guided import.
  if (changeInfo.status === "complete") void advanceJob(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void dropJobIfForTab(tabId);
});
