// The shadow-rooted host every piece of in-page UI lives in (the floating icon, its panel, the
// setup modal, the full-page overlays), so none of it is styled by -- or styles -- the provider's
// own page.

import { createIcon } from "../shared/icon";
import css from "./styles/content.scss?inline";

const HOST_ID = "thingport-grab-host";

let shadowRoot: ShadowRoot | null = null;
let panelEl: HTMLDivElement | null = null;
let contentEl: HTMLDivElement | null = null;

export function mountHost(): ShadowRoot {
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.documentElement.appendChild(host);
  shadowRoot = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  shadowRoot.appendChild(style);
  return shadowRoot;
}

export function getShadowRoot(): ShadowRoot | null {
  return shadowRoot;
}

export function unmountHost(): void {
  document.getElementById(HOST_ID)?.remove();
  shadowRoot = null;
  panelEl = null;
  contentEl = null;
}

type FabOptions = { variant?: "in-library" | "inactive"; label: string; title?: string; onClick: () => void };

export function mountFab(root: ShadowRoot, { variant, label, title, onClick }: FabOptions): void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = variant ? `tg-fab tg-fab--${variant}` : "tg-fab";
  button.setAttribute("aria-label", label);
  if (title) button.title = title;
  button.appendChild(createIcon());
  button.addEventListener("click", onClick);
  root.appendChild(button);
}

/** The panel above the icon. `onFirstOpen` runs once, the first time it's opened. Returns the
 *  toggle the icon's click handler calls. */
export function mountPanel(root: ShadowRoot, onFirstOpen: () => void): () => void {
  const panel = document.createElement("div");
  panel.className = "tg-panel";
  panel.hidden = true;

  // Outside contentEl (renderPanel's target) so it survives every re-render.
  const closeBtn = document.createElement("button");
  closeBtn.className = "tg-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => setPanelOpen(false));
  panel.appendChild(closeBtn);

  const content = document.createElement("div");
  content.className = "tg-panel__content";
  panel.appendChild(content);
  root.appendChild(panel);

  panelEl = panel;
  contentEl = content;
  let loaded = false;
  return () => {
    const open = panel.hidden;
    setPanelOpen(open);
    if (open && !loaded) {
      loaded = true;
      onFirstOpen();
    }
  };
}

export function setPanelOpen(open: boolean): void {
  if (panelEl) panelEl.hidden = !open;
}

/** Whether the panel still exists -- false once unmountHost() ran (e.g. an SPA route change). */
export function isPanelMounted(): boolean {
  return contentEl !== null;
}

export function renderPanel(html: string): void {
  // A no-op, not a bug, once the panel's been torn down mid-flow -- a still-in-flight step (like
  // the batch progress poll) has nothing left to draw into, but the request/job it's watching keeps
  // running regardless (see background/importJobs.ts).
  if (!contentEl) return;
  contentEl.innerHTML = html;
}

export function panelQuery<T extends Element = HTMLElement>(selector: string): T | null {
  return panelEl ? panelEl.querySelector<T>(selector) : null;
}

export function panelQueryAll<T extends Element = HTMLElement>(selector: string): T[] {
  return panelEl ? [...panelEl.querySelectorAll<T>(selector)] : [];
}

export function onPanelAction(action: string, handler: () => void): void {
  panelQuery(`[data-action="${action}"]`)?.addEventListener("click", handler);
}
