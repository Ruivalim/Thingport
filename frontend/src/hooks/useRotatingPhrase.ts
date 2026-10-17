import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Long enough to read one, short enough that a run of a few minutes shows several.
const PHRASE_MS = 3500;

/** One of the `app` namespace's `key` phrases, moving to the next every few seconds while `running`. */
export function useRotatingPhrase(key: string, running: boolean): string {
  const { t } = useTranslation("app");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setIndex((current) => current + 1), PHRASE_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  const phrases = t(key, { returnObjects: true }) as string[];
  return Array.isArray(phrases) && phrases.length ? phrases[index % phrases.length] : "";
}
