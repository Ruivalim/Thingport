import { STORAGE_KEYS, normalizeInstanceUrl, type StoredConfig } from "../shared/storage";
import type { ExtensionState } from "../shared/messages";
import { loginAndStoreToken } from "./api";

export async function getStoredConfig(): Promise<StoredConfig> {
  return chrome.storage.local.get(Object.values(STORAGE_KEYS)) as Promise<StoredConfig>;
}

export type ConfiguredConfig = StoredConfig & { instanceUrl: string; email: string; password: string };

export function isConfigured(config: StoredConfig): config is ConfiguredConfig {
  return Boolean(config.instanceUrl && config.email && config.password);
}

export async function getState(): Promise<ExtensionState> {
  const config = await getStoredConfig();
  return {
    configured: isConfigured(config),
    disabled: Boolean(config.disabled),
    instanceUrl: config.instanceUrl || "",
    email: config.email || "",
  };
}

// The host permission for the chosen instance origin is requested by the popup itself, not here --
// chrome.permissions.request() must run within the user gesture that triggered it (the popup's
// own submit click), which doesn't survive a runtime.sendMessage hop into the background. By the
// time SAVE_CONFIG arrives, the popup has already been granted (or refused, in which case it
// never sends this) that permission.
export async function saveConfig({ instanceUrl, email, password }: { instanceUrl: string; email: string; password: string }): Promise<null> {
  const normalized = normalizeInstanceUrl(instanceUrl);
  // Validate before persisting -- a typo'd URL or wrong password shouldn't silently save.
  await loginAndStoreToken({ instanceUrl: normalized, email, password });
  await chrome.storage.local.set({ instanceUrl: normalized, email, password, disabled: false });
  return null;
}

export async function setDisabled(disabled: boolean): Promise<null> {
  await chrome.storage.local.set({ disabled: Boolean(disabled) });
  return null;
}
