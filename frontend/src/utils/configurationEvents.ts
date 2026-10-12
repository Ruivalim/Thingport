import type { ConfigurationTab } from "../components/Layout/ConfigurationDialog";

// The top bar owns the Configuration dialog; anything else asks it to open through these.
const OPEN_EVENT = "thingport:open-configuration";
const CLOSED_EVENT = "thingport:configuration-closed";

export function openConfiguration(tab: ConfigurationTab): void {
  window.dispatchEvent(new CustomEvent<ConfigurationTab>(OPEN_EVENT, { detail: tab }));
}

/** Returns the unsubscribe. */
export function onOpenConfiguration(handler: (tab: ConfigurationTab) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<ConfigurationTab>).detail);
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

export function notifyConfigurationClosed(): void {
  window.dispatchEvent(new Event(CLOSED_EVENT));
}

/** For whatever depends on settings changed there, e.g. a provider just connected. */
export function onConfigurationClosed(handler: () => void): () => void {
  window.addEventListener(CLOSED_EVENT, handler);
  return () => window.removeEventListener(CLOSED_EVENT, handler);
}
