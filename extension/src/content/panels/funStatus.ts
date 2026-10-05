// Loading states that cycle through short, playful phrases about the work in progress, so a wait of
// a few seconds reads as something happening rather than a stuck panel.

import type { Provider } from "../../shared/urls";
import { escapeHtml } from "../runtime";
import { panelQuery, renderPanel } from "../shell";

const ROTATE_MS = 2500;

const SITE_NAMES: Record<Provider, string> = {
  makerworld: "MakerWorld",
  printables: "Printables",
  thingiverse: "Thingiverse",
};

/** While the instance inspects the link: what file it is, its title, whether it's a zip. */
export function checkingLinkPhrases(provider: Provider): string[] {
  return [
    "Checking the link…",
    `Asking ${SITE_NAMES[provider]} nicely…`,
    "Sniffing out the file…",
    "Peeking behind the download button…",
    "Crunching the model…",
    "Taking the photos…",
    "Measuring twice…",
    "Counting the layers…",
    "Warming up the nozzle…",
    "Leveling the bed…",
    "Unspooling the filament…",
    "Reading the fine print…",
    "Untangling the supports…",
  ];
}

let rotation: ReturnType<typeof setInterval> | undefined;

/** Shows the first phrase, then a random other one every few seconds (never the same twice in a
 *  row) until the panel renders something else. */
export function renderFunStatus(phrases: readonly string[]): void {
  clearInterval(rotation);
  renderPanel(`<div class="tg-status tg-status--fun">${escapeHtml(phrases[0])}</div>`);
  const el = panelQuery<HTMLElement>(".tg-status--fun");
  if (!el || phrases.length < 2) return;
  let current = 0;
  rotation = setInterval(() => {
    if (!el.isConnected) {
      clearInterval(rotation);
      return;
    }
    let next = Math.floor(Math.random() * (phrases.length - 1));
    if (next >= current) next += 1;
    current = next;
    el.textContent = phrases[current];
    // Restarts the fade-in on every change.
    el.classList.remove("tg-status--fun");
    void el.offsetWidth;
    el.classList.add("tg-status--fun");
  }, ROTATE_MS);
}
