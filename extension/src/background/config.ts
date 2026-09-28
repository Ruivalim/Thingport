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

// The popup requests the host permission itself: it needs the submit's user gesture.
export async function saveConfig({
  instanceUrl,
  email,
  password,
}: {
  instanceUrl: string;
  email: string;
  password: string;
}): Promise<null> {
  const normalized = normalizeInstanceUrl(instanceUrl);
  // Validate before persisting.
  await loginAndStoreToken({ instanceUrl: normalized, email, password });
  await chrome.storage.local.set({ instanceUrl: normalized, email, password, disabled: false });
  return null;
}

export async function setDisabled(disabled: boolean): Promise<null> {
  await chrome.storage.local.set({ disabled: Boolean(disabled) });
  return null;
}
