// Full-page overlays for the guided MakerWorld import and the collection scan. They cover the whole
// page on purpose: there's nothing to do meanwhile but wait or abort.

import type { MakerworldJob } from "../shared/messages";
import { send } from "../shared/messages";
import { fillIcons } from "../shared/icon";

// Long enough never to show during a normal step, short enough for a stuck one.
const JOB_STUCK_REVEAL_MS = 20000;

function overlayHtml(title: string, countHtml: string, extra = ""): string {
  return `
    <div class="tg-overlay__card">
      <span class="tg-overlay__icon" data-icon></span>
      <div class="tg-overlay__title">${title}</div>
      ${countHtml}
      ${extra}
    </div>
  `;
}

export function mountJobOverlay(root: ShadowRoot, job: MakerworldJob): void {
  const overlay = document.createElement("div");
  overlay.className = "tg-overlay";
  const percent = job.total ? Math.round((job.imported / job.total) * 100) : 0;
  overlay.innerHTML = overlayHtml(
    "Importing from MakerWorld…",
    `<div class="tg-overlay__count">${job.imported} / ${job.total} models imported (${percent}%)</div>
     <div class="tg-progress"><div class="tg-progress__bar" style="width:${percent}%"></div></div>`,
    `<button class="tg-btn tg-btn--danger" type="button" data-action="abort">Abort</button>
     <button class="tg-btn tg-btn--secondary" type="button" data-action="next" hidden>Import next</button>`,
  );
  fillIcons(overlay);
  root.appendChild(overlay);

  const abortBtn = overlay.querySelector<HTMLButtonElement>("[data-action=abort]")!;
  abortBtn.addEventListener("click", () => {
    abortBtn.disabled = true;
    abortBtn.textContent = "Aborting…";
    void send("ABORT_MAKERWORLD_COLLECTION_JOB");
  });

  // Normally the page navigates on first, tearing this timer down.
  const nextBtn = overlay.querySelector<HTMLButtonElement>("[data-action=next]")!;
  setTimeout(() => {
    nextBtn.hidden = false;
  }, JOB_STUCK_REVEAL_MS);
  nextBtn.addEventListener("click", () => {
    nextBtn.disabled = true;
    nextBtn.textContent = "Checking…";
    void send("FORCE_ADVANCE_MAKERWORLD_JOB");
  });
}

export type ScanOverlay = { update(count: number): void; remove(): void };

export function mountScanOverlay(root: ShadowRoot): ScanOverlay {
  const overlay = document.createElement("div");
  overlay.className = "tg-overlay";
  overlay.innerHTML = overlayHtml(
    "Scanning collection models…",
    `<div class="tg-overlay__count" data-role="count">0 found so far</div>`,
  );
  fillIcons(overlay);
  root.appendChild(overlay);
  const countEl = overlay.querySelector<HTMLElement>('[data-role="count"]')!;
  return {
    update: (count) => {
      countEl.textContent = `${count} found so far`;
    },
    remove: () => overlay.remove(),
  };
}
