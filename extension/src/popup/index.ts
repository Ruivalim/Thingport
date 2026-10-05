// Toolbar popup (or a tab, when the browser won't open the popup): the setup form until configured,
// then the enable switch and recent imports.

import { fillIcons } from "../shared/icon";
import { send, type ExtensionState } from "../shared/messages";
import { normalizeInstanceUrl } from "../shared/storage";
import { clearError, els, showError } from "./dom";
import { loadRecentImports } from "./recentImports";
import "./styles/popup.scss";

// When opened as a tab from a page's setup dialog, return there once saved.
const returnTabId = Number.parseInt(new URLSearchParams(location.search).get("returnTab") ?? "", 10);

fillIcons(document);
// Bumped by semantic-release in package.json, which the build copies into the manifest.
els.version.textContent = `v${chrome.runtime.getManifest().version}`;

function displayInstanceUrl(instanceUrl: string): string {
  return instanceUrl.replace(/^https?:\/\//i, "");
}

function showConfiguredView(state: ExtensionState): void {
  els.configuredView.hidden = false;
  els.setupForm.hidden = true;
  els.instanceRow.hidden = false;
  els.enabledToggle.hidden = false;
  els.instanceUrlText.textContent = displayInstanceUrl(state.instanceUrl);
  els.instanceUrlText.title = state.instanceUrl;
  els.enabledSwitch.checked = !state.disabled;
  clearError(els.configuredError);
  void loadRecentImports();
}

function showSetupForm(prefillUrl = "", prefillEmail = ""): void {
  els.configuredView.hidden = true;
  els.instanceRow.hidden = true;
  els.enabledToggle.hidden = true;
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
    // Must happen here: permissions.request() needs this submit's user gesture.
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
