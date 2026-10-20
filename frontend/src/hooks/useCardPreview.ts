import { useEffect, useState } from "react";
import { settingsApi, type CardPreview } from "../api/settings";

// Saved on the account so every device shows the same pictures. Shared by every card so there's one request, and a
// switch shows everywhere at once.
let cached: CardPreview | undefined;
let inFlight: Promise<CardPreview> | null = null;
const listeners = new Set<(value: CardPreview) => void>();

function load(): Promise<CardPreview> {
  if (cached !== undefined) return Promise.resolve(cached);
  // A switch made while this is in flight is newer than the server's answer, so it wins.
  inFlight ??= settingsApi
    .getCardPreview()
    .then((res) => (cached ??= res.preview))
    .catch((): CardPreview => cached ?? "images")
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function publish(value: CardPreview) {
  cached = value;
  listeners.forEach((listener) => listener(value));
}

/** Null until the saved choice is known, so cards don't flash the wrong picture first. */
export function useCardPreview(): [CardPreview | null, (preview: CardPreview) => void] {
  const [value, setValue] = useState<CardPreview | null>(cached ?? null);

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

  const update = (preview: CardPreview) => {
    publish(preview);
    // The switch already happened here; a failed save only means other devices won't follow.
    settingsApi.updateCardPreview(preview).catch(() => {});
  };

  return [value, update];
}
