// Toolbar popup (also opened as a tab by background/setup.ts when the browser won't open the popup
// for the in-page setup dialog). Shows the setup form until the extension is configured, then the
// enable switch and the recent-imports strip.

import { fillIcons } from "../shared/icon";
import { send, type ExtensionState } from "../shared/messages";
import { normalizeInstanceUrl } from "../shared/storage";
import { clearError, els, showError } from "./dom";
import { loadRecentImports } from "./recentImports";
import "./styles/popup.scss";

// Set when background/setup.ts had to open this page in a tab from a page's setup dialog: once
// saved, go back to that page -- its icon has already switched to the active one -- instead of
// leaving this tab behind.
const returnTabId = Number.parseInt(new URLSearchParams(location.search).get("returnTab") ?? "", 10);

fillIcons(document);

/** The instance URL as shown under the title -- the scheme is noise at this size. */
function displayInstanceUrl(instanceUrl: string): string {
  return instanceUrl.replace(/^https?:\/\//i, "");
}

function showConfiguredView(state: ExtensionState): void {
  els.configuredView.hidden = false;
  els.setupForm.hidden = true;
  els.instanceRow.hidden = false;
  els.instanceUrlText.textContent = displayInstanceUrl(state.instanceUrl);
  els.instanceUrlText.title = state.instanceUrl;
  els.enabledSwitch.checked = !state.disabled;
  clearError(els.configuredError);
  void loadRecentImports();
}

function showSetupForm(prefillUrl = "", prefillEmail = ""): void {
  els.configuredView.hidden = true;
  els.instanceRow.hidden = true;
  els.setupForm.hidden = false;
  els.cancelBtn.hidden = !prefillUrl;
  els.instanceUrlInput.value = prefillUrl;
  els.emailInput.value = prefillEmail;
  els.passwordInput.value = "";
  clearError();
  els.instanceUrlInput.focus();
}

async function refresh(): Promise<void> {
  const res = await send("GET_STATE");
  if (!res?.ok) {
    showError(res?.error ?? "The extension background isn't responding");
    return;
  }
  if (res.data.configured) showConfiguredView(res.data);
  else showSetupForm();
}

els.editInstanceBtn.addEventListener("click", async () => {
  const res = await send("GET_STATE");
  showSetupForm(res?.ok ? res.data.instanceUrl : "", res?.ok ? res.data.email : "");
});

els.cancelBtn.addEventListener("click", () => void refresh());

els.enabledSwitch.addEventListener("change", async () => {
  clearError(els.configuredError);
  els.enabledSwitch.disabled = true;
  const res = await send("SET_DISABLED", { disabled: !els.enabledSwitch.checked });
  els.enabledSwitch.disabled = false;
  if (!res?.ok) {
    showError(res?.error ?? "Couldn't save", els.configuredError);
    els.enabledSwitch.checked = !els.enabledSwitch.checked;
  }
});

els.setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const normalized = normalizeInstanceUrl(els.instanceUrlInput.value);
  let origin: string;
  try {
    origin = new URL(normalized).origin;
  } catch {
    showError("Enter a valid instance URL, e.g. https://thingport.example.com");
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Saving…";
  try {
    // Must be called right here, not in the background's SAVE_CONFIG handler --
    // permissions.request() needs the user gesture this submit carries, which a sendMessage hop
    // would lose.
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      showError("Thingport Grab needs permission to reach this instance to work.");
      return;
    }
    const res = await send("SAVE_CONFIG", {
      instanceUrl: normalized,
      email: els.emailInput.value,
      password: els.passwordInput.value,
    });
    if (!res?.ok) {
      showError(res?.error ?? "Couldn't save");
      return;
    }
    if (Number.isInteger(returnTabId)) {
      await chrome.tabs.update(returnTabId, { active: true }).catch(() => undefined);
      const self = await chrome.tabs.getCurrent();
      if (self?.id != null) await chrome.tabs.remove(self.id);
      return;
    }
    await refresh();
  } finally {
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save";
  }
});

void refresh();
