import { useEffect, useState } from "react";
import { settingsApi, type CategoriesView } from "../api/settings";

// Saved on the account so every device and window opens on the same tree. Shared by every user of
// the hook so there's one request, and a switch shows everywhere at once.
let cached: CategoriesView | undefined;
let inFlight: Promise<CategoriesView> | null = null;
const listeners = new Set<(value: CategoriesView) => void>();

function load(): Promise<CategoriesView> {
  if (cached !== undefined) return Promise.resolve(cached);
  // A switch made while this is in flight is newer than the server's answer, so it wins.
  inFlight ??= settingsApi
    .getCategoriesView()
    .then((res) => (cached ??= res.view))
    .catch((): CategoriesView => cached ?? "categories")
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function publish(value: CategoriesView) {
  cached = value;
  listeners.forEach((listener) => listener(value));
}

/** Null until the saved choice is known, so the page doesn't flash the wrong tree. */
export function useCategoriesView(): [CategoriesView | null, (view: CategoriesView) => void] {
  const [value, setValue] = useState<CategoriesView | null>(cached ?? null);

  useEffect(() => {
    let cancelled = false;
    void load().then((v) => {
      if (!cancelled) setValue(cached ?? v);
    });
    listeners.add(setValue);
    return () => {
      cancelled = true;
      listeners.delete(setValue);
    };
  }, []);

  const update = (view: CategoriesView) => {
    publish(view);
    // The switch already happened here; a failed save only means other devices won't follow.
    settingsApi.updateCategoriesView(view).catch(() => {});
  };

  return [value, update];
}
