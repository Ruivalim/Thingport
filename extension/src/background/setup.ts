/** Content scripts can't open the popup or request host permissions, so open the popup where the
 *  browser allows it (Chrome 127+), else the same page in a tab. `returnTabId` lets the tab switch
 *  back once saved. */
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
