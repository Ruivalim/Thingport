import { useEffect, useState } from "react";
import { settingsApi, type CardPreview } from "../api/settings";

// Saved on the account so every device shows the same pictures. Shared by every card so there's one request, and a
// switch shows everywhere at once.
let cached: CardPreview | undefined;
let inFlight: Promise<CardPreview> | null = null;
// Bumped on sign-in, so an answer still on its way for the previous account is dropped.
let account = 0;
const listeners = new Set<(value: CardPreview) => void>();

function load(): Promise<CardPreview> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  const forAccount = account;
  // A switch made while this is in flight is newer than the server's answer, so it wins.
  const request = settingsApi
    .getCardPreview()
    .then((res) => (forAccount === account ? (cached ??= res.preview) : res.preview))
    .catch((): CardPreview => cached ?? "images")
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}

function publish(value: CardPreview) {
  cached = value;
  listeners.forEach((listener) => listener(value));
}

/** Forgets the previous account's choice; call on sign-in. */
export function resetCardPreview() {
  account++;
  cached = undefined;
  inFlight = null;
}

/** Null until the saved choice is known, so cards don't flash the wrong picture first. The setter shows the switch
 *  straight away, puts it back if the save fails, and rejects with the save's error. */
export function useCardPreview(): [CardPreview | null, (preview: CardPreview) => Promise<void>] {
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

  const update = async (preview: CardPreview) => {
    const previous = cached ?? "images";
    publish(preview);
    try {
      await settingsApi.updateCardPreview(preview);
    } catch (err) {
      // Only if nothing newer was picked meanwhile.
      if (cached === preview) publish(previous);
      throw err;
    }
  };

  return [value, update];
}
