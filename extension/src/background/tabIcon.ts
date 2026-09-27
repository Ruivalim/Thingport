// The toolbar icon is active (color) only for a tab where the floating in-page icon is actually
// showing right now -- configured, enabled, AND a recognized, not-already-imported provider page.
// Everywhere else it's the dark/inactive one (the manifest's action.default_icon). The content
// script reports this per page via SET_TAB_ICON_STATE; index.ts resets it the moment a new
// navigation starts, so a tab doesn't keep showing "active" after leaving for a page this
// extension never runs on.

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
