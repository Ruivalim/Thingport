/** Opens the setup form for the content script's setup modal (the grayed-out icon on a supported
 *  page before the extension is configured). Content scripts can't open the popup or request host
 *  permissions themselves, and the click that led here doesn't carry over a runtime message, so:
 *  the toolbar popup where the browser lets an extension open it without one (Chrome 127+),
 *  otherwise the same page in a tab -- either way an extension page, which is what the popup's
 *  permission prompt on Save needs. `returnTabId` lets the tab version switch back to the page the
 *  user came from once saved. */
export async function openSetup(returnTabId: number | undefined): Promise<"popup" | "tab"> {
  try {
    await chrome.action.openPopup();
    return "popup";
  } catch {
    const query = returnTabId != null ? `?returnTab=${returnTabId}` : "";
    await chrome.tabs.create({ url: chrome.runtime.getURL(`popup.html${query}`) });
    return "tab";
  }
}
