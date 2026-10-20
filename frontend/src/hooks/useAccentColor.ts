import { useSyncExternalStore } from "react";
import { DEFAULT_ACCENT, type AccentColor } from "../constants/settingsOptions";

// One value for the whole app: App builds the theme from it and the Appearance panel changes it, so a pick
// recolours everything at once. App loads it with the theme.
let current: AccentColor = DEFAULT_ACCENT;
const listeners = new Set<() => void>();

export function setCachedAccentColor(accent: AccentColor) {
  current = accent;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAccentColor(): AccentColor {
  return useSyncExternalStore(subscribe, () => current);
}
