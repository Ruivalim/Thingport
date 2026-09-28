// The toolbar icon is active only while the floating in-page icon is showing. Content scripts
// report it via SET_TAB_ICON_STATE; index.ts resets it on every navigation.

function iconPaths(active: boolean): Record<number, string> {
  const prefix = active ? "thingport-icon-color" : "thingport-icon-dark";
  return {
    16: `icons/${prefix}-16.png`,
    32: `icons/${prefix}-32.png`,
    48: `icons/${prefix}-48.png`,
    128: `icons/${prefix}-128.png`,
  };
}

export async function setTabIconState(tabId: number, active: boolean): Promise<null> {
  await chrome.action.setIcon({ tabId, path: iconPaths(active) }).catch(() => undefined);
  return null;
}
