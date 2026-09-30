// "Download normalized" next to MakerWorld's own Download button, for people whose slicer mis-reads
// Bambu Studio projects: not linked to a Thingport instance at all, or linked with such a slicer
// picked. The file is downloaded and converted in this tab; it never goes anywhere else.

import { NORMALIZE_3MF_SLICERS } from "../../shared/slicers";
import { api } from "../runtime";
import css from "../styles/normalized.scss?inline";
import { findDownloadButton, isDownloadButton, resolveMakerworldDownloadUrl } from "./downloadResolver";
import { normalizeBambu3mf } from "./normalize";

// Converting holds the file, its unzipped model XML and the result in memory at once.
const MAX_BYTES = 50 * 1024 * 1024;
const MB = 1024 * 1024;
const HOST_ID = "thingport-grab-normalized";
const LABEL = "Download normalized";
const DONE_RESET_MS = 3000;
const ERROR_SHOW_MS = 10000;

// Material Design "Lightbulb" (Apache 2.0), the web app's icon for the same option.
const BULB_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7"/></svg>';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function bulbIcon(): Element {
  return document.importNode(new DOMParser().parseFromString(BULB_SVG, "image/svg+xml").documentElement, true);
}

let host: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let bubbleTimer: ReturnType<typeof setTimeout> | undefined;

function explanation(slicerLabel: string | null): string {
  const slicers = slicerLabel ? `${slicerLabel} often opens` : "PrusaSlicer, Cura and other slicers often open";
  return (
    `MakerWorld files are Bambu Studio projects, which ${slicers} without their colors or print ` +
    "settings. This downloads a converted copy that keeps painted colors, filament colors, plates and the " +
    "designer's settings (walls, layer height, infill, supports). Heads up: multi-part objects may be merged into " +
    "one, per-object overrides and layer color changes are dropped, and you pick your own printer profile. " +
    "Converted in your browser by Thingport Grab."
  );
}

function tooBig(bytes: number): Error {
  return new Error(
    `This file is ${Math.round(bytes / MB)} MB, too big to normalize in the browser (the limit is ${MAX_BYTES / MB} MB). ` +
      "Use MakerWorld's regular Download instead.",
  );
}

async function readBody(
  res: Response,
  declared: number | null,
  onProgress: (text: string) => void,
): Promise<ArrayBuffer> {
  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      void reader.cancel();
      throw tooBig(declared ?? received);
    }
    chunks.push(value);
    const got = (received / MB).toFixed(1);
    onProgress(declared ? `Downloading ${got} of ${(declared / MB).toFixed(1)} MB…` : `Downloading ${got} MB…`);
  }
  return new Blob(chunks as BlobPart[]).arrayBuffer();
}

/** From Content-Disposition, else the URL's last path segment. */
function sourceFilename(res: Response, url: string): string {
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const encoded = disposition.match(/filename\*\s*=\s*[^']*'[^']*'([^;]+)/i)?.[1];
  const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1];
  let name = "";
  try {
    name = decodeURIComponent(encoded ?? plain ?? new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    name = plain ?? "";
  }
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "model.3mf";
}

function normalizedFilename(source: string): string {
  return `${source.replace(/\.3mf$/i, "")}-normalized.3mf`;
}

function saveFile(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "model/3mf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadNormalized(pageUrl: string, onProgress: (text: string) => void): Promise<void> {
  onProgress("Getting file…");
  const resolved = await resolveMakerworldDownloadUrl(pageUrl);
  if (!resolved) {
    throw new Error(
      "Couldn't get this model's file from MakerWorld. Make sure you're signed in to MakerWorld, then try again.",
    );
  }
  const res = await fetch(resolved.downloadUrl);
  if (!res.ok) throw new Error(`MakerWorld's file server refused the download (${res.status}). Try again in a moment.`);
  const declared = Number(res.headers.get("Content-Length")) || null;
  if (declared && declared > MAX_BYTES) {
    void res.body?.cancel();
    throw tooBig(declared);
  }
  const input = await readBody(res, declared, onProgress);
  onProgress("Normalizing…");
  let output: Uint8Array;
  try {
    output = await normalizeBambu3mf(input);
  } catch (err) {
    throw new Error("Couldn't normalize this file: it doesn't look like a 3MF project MakerWorld's Download gives.", {
      cause: err,
    });
  }
  saveFile(output, normalizedFilename(sourceFilename(res, resolved.downloadUrl)));
}

function buildHost(pageUrl: string, slicerLabel: string | null): HTMLElement {
  const el = document.createElement("span");
  el.id = HOST_ID;
  const root = el.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const button = element("button", "tg-nd");
  button.type = "button";
  button.setAttribute("aria-describedby", "tg-nd-info");
  const icon = element("span", "tg-nd__info");
  icon.append(bulbIcon());
  const label = element("span", "tg-nd__label");
  label.textContent = LABEL;
  button.append(icon, label);
  const bubble = element("div", "tg-nd-bubble");
  bubble.id = "tg-nd-info";
  bubble.setAttribute("role", "tooltip");
  bubble.hidden = true;
  root.append(style, button, bubble);

  const showBubble = (text: string, error = false) => {
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.classList.toggle("tg-nd-bubble--error", error);
    bubble.hidden = false;
    // Fixed, so an ancestor's overflow can't clip it.
    const rect = button.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - bubble.offsetWidth - 8);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${rect.bottom + 8}px`;
    if (error) bubbleTimer = setTimeout(hideBubble, ERROR_SHOW_MS);
  };
  const hideBubble = () => {
    clearTimeout(bubbleTimer);
    bubble.hidden = true;
  };
  const showInfo = () => {
    if (bubble.hidden) showBubble(explanation(slicerLabel));
  };
  icon.addEventListener("mouseenter", showInfo);
  icon.addEventListener("mouseleave", () => !bubble.classList.contains("tg-nd-bubble--error") && hideBubble());
  button.addEventListener("focus", () => button.matches(":focus-visible") && showInfo());
  button.addEventListener("blur", () => !bubble.classList.contains("tg-nd-bubble--error") && hideBubble());

  button.addEventListener("click", async () => {
    hideBubble();
    button.disabled = true;
    icon.replaceChildren(element("span", "tg-nd__spinner"));
    try {
      await downloadNormalized(pageUrl, (text) => (label.textContent = text));
      label.textContent = "Downloaded";
      await new Promise((resolve) => setTimeout(resolve, DONE_RESET_MS));
    } catch (err) {
      showBubble(err instanceof Error ? err.message : String(err), true);
    } finally {
      button.disabled = false;
      icon.replaceChildren(bulbIcon());
      label.textContent = LABEL;
    }
  });
  return el;
}

/** Keeps the button right after MakerWorld's, which can render late or be re-rendered away. */
function place(): void {
  if (!host) return;
  const anchor = host.previousElementSibling;
  if (host.isConnected && anchor && isDownloadButton(anchor)) return;
  const button = findDownloadButton();
  if (!button) {
    host.remove();
    return;
  }
  button.after(host);
  // A flex/grid gap already spaces it; the margin is for plain inline layouts.
  const gap = getComputedStyle(button.parentElement!).columnGap;
  host.style.marginLeft = gap && gap !== "normal" && gap !== "0px" ? "0" : "";
}

function mount(pageUrl: string, slicerLabel: string | null): void {
  unmountNormalizedDownload();
  host = buildHost(pageUrl, slicerLabel);
  let scheduled = false;
  observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      place();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  place();
}

export function unmountNormalizedDownload(): void {
  observer?.disconnect();
  observer = null;
  host?.remove();
  host = null;
  clearTimeout(bubbleTimer);
}

/** Offered when the user isn't linked to Thingport, or is but picked a slicer that needs it. */
export async function offerNormalizedDownload(
  pageUrl: string,
  configured: boolean,
  isStale: () => boolean,
): Promise<void> {
  let slicerLabel: string | null = null;
  if (configured) {
    try {
      const { slicer } = await api<{ slicer: string | null }>("GET", "/settings/slicer");
      slicerLabel = slicer ? (NORMALIZE_3MF_SLICERS[slicer] ?? null) : null;
    } catch {
      return;
    }
    if (!slicerLabel) return;
  }
  if (!isStale()) mount(pageUrl, slicerLabel);
}
