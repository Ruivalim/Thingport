// Single-model flow. Thingiverse Things and Printables Models go straight to import; a MakerWorld
// model link (and any other generic single link) goes through /import/inspect first -- mirroring
// the web app's useUploadImport.tsx branching.

import type { InspectResult, ZipEntriesResult } from "../../shared/api";
import { request } from "../../shared/messages";
import { ctx } from "../context";
import { resolveMakerworldDownloadUrl } from "../makerworld/downloadResolver";
import { currentMakerworldProfileTitle } from "../makerworld/pageData";
import { api, escapeHtml } from "../runtime";
import { onPanelAction, panelQueryAll, renderPanel } from "../shell";
import { collectionPickerHtml, selectedCollectionId } from "./collectionPicker";
import { errorHtml, statusHtml, successHtml } from "./results";

/** Best-effort model name for the heading, read from the page -- only for pages that skip
 *  /import/inspect (and so never get its resolved `title`). The page's own <h1> first: both sites
 *  are SPAs, and Thingiverse never updates og:title on client-side navigation (it stays the site's
 *  generic "Thingiverse - The community for Open Hardware"), while Printables' carries a
 *  "| Download free STL model | Printables.com" suffix. */
function guessPageTitle(): string | null {
  const h1 = document.querySelector("h1")?.textContent?.trim();
  if (h1) return h1;
  const og = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim();
  return og || document.title.trim() || null;
}

function importHeading(): string {
  const { title } = ctx();
  return title ? `Import "${escapeHtml(title)}"` : "Import this model";
}

export async function loadSingleItem(): Promise<void> {
  // Nothing inspect would tell us matters for an add-profile (a MakerWorld profile is always a
  // single 3MF), and inspecting would make the backend resolve the download just to show the panel.
  if (ctx().library) {
    renderPanel(addProfileHtml());
    onPanelAction("import", () => void runDirectImport());
    return;
  }
  renderPanel(statusHtml("Checking link…"));
  const { provider, type } = ctx().classification;
  // Printables' generic page-fetch flow is Cloudflare-gated and a Thingiverse Thing always resolves
  // through its own API path -- see useUploadImport.tsx's identical special-case. Neither needs (or
  // can safely use) /import/inspect.
  const skipInspect = (provider === "thingiverse" && type === "thing") || (provider === "printables" && type === "model");

  let zipFilename: string | null = null;
  if (skipInspect) {
    ctx().title = guessPageTitle();
  } else {
    try {
      const inspect = await api<InspectResult>("POST", "/import/inspect", { url: ctx().url });
      ctx().title = inspect.title || null;
      if (inspect.is_zip) zipFilename = inspect.filename ?? "This file";
    } catch (err) {
      renderPanel(errorHtml(err));
      return;
    }
  }

  if (zipFilename === null) {
    renderPanel(`
      <div class="tg-title">${importHeading()}</div>
      ${await collectionPickerHtml()}
      <button class="tg-btn" type="button" data-action="import">Import</button>
    `);
    onPanelAction("import", () => void runDirectImport());
    return;
  }

  renderPanel(`
    <div class="tg-title">${importHeading()}</div>
    <div class="tg-hint">${escapeHtml(zipFilename)} contains multiple files.</div>
    ${await collectionPickerHtml()}
    <button class="tg-btn" type="button" data-action="import-as-zip">Import as one model</button>
    <button class="tg-btn tg-btn--secondary" type="button" data-action="choose-files">Choose files…</button>
  `);
  onPanelAction("import-as-zip", () => void runDirectImport());
  onPanelAction("choose-files", () => void loadZipEntries());
}

/** The model's already in the library, but this page's print profile isn't known to be -- each
 *  MakerWorld profile has its own 3MF, stored as its own file on the one model. No collection
 *  picker: the model's collections are already whatever they are. */
function addProfileHtml(): string {
  const { library, url, instanceUrl } = ctx();
  const profileName = currentMakerworldProfileTitle(url);
  const profileLabel = profileName ? `the "${escapeHtml(profileName)}" profile` : "this print profile";
  const hint =
    library?.state === "profile_missing"
      ? `You already have this model. Add ${profileLabel} as another file on it?`
      : `This model is in your library. Add ${profileLabel} if you don't have it yet -- if one of the model's files already is this profile, nothing is downloaded twice.`;
  const modelLink = library?.printId ? `${instanceUrl}/models/${library.printId}` : `${instanceUrl}/models`;
  return `
    <div class="tg-title">In your library</div>
    <div class="tg-hint">${hint}</div>
    <button class="tg-btn" type="button" data-action="import">Add profile</button>
    <a class="tg-btn tg-btn--secondary" href="${escapeHtml(modelLink)}" target="_blank" rel="noopener noreferrer">Open model in Thingport</a>
  `;
}

async function loadZipEntries(): Promise<void> {
  renderPanel(statusHtml("Loading files…"));
  let result: ZipEntriesResult;
  try {
    result = await api<ZipEntriesResult>("POST", "/import/zip/entries", { url: ctx().url });
  } catch (err) {
    renderPanel(errorHtml(err));
    return;
  }
  const rows = result.entries
    .map(
      (entry) => `
        <label class="tg-entry">
          <input type="checkbox" class="tg-entry__checkbox" value="${escapeHtml(entry)}" checked />
          <span class="tg-entry__name">${escapeHtml(entry)}</span>
        </label>
      `,
    )
    .join("");
  renderPanel(`
    <div class="tg-title">Choose files to import</div>
    <div class="tg-entries">${rows}</div>
    ${await collectionPickerHtml()}
    <button class="tg-btn" type="button" data-action="import">Import selected</button>
  `);
  onPanelAction("import", () => {
    const entries = panelQueryAll<HTMLInputElement>(".tg-entry__checkbox:checked").map((el) => el.value);
    if (entries.length) void runDirectImport({ entries });
  });
}

async function runDirectImport(opts?: { entries?: string[] }): Promise<void> {
  // Captured up front: if the page navigates (an SPA route change) while the import is in flight,
  // the context is cleared from under this still-running function (see unmount in index.ts).
  const collectionId = selectedCollectionId();
  const { url, instanceUrl, classification, title } = ctx();
  renderPanel(statusHtml("Importing…"));
  // Only meaningful for a MakerWorld model page -- see downloadResolver.ts for why resolving it
  // here beats leaving it to the backend.
  const resolved =
    classification.provider === "makerworld" && classification.type === "model"
      ? await resolveMakerworldDownloadUrl(url).catch(() => null)
      : null;
  try {
    // One message, not two: the import and (per collectionId) filing it into a collection both
    // run to completion in the background even if this page is gone by the time it finishes.
    const print = await request("IMPORT_SINGLE", { url, entries: opts?.entries, collectionId, resolved, title });
    const link = print ? `${instanceUrl}/models/${print.id}` : `${instanceUrl}/models`;
    if (print?.import_outcome === "profile_added") {
      renderPanel(successHtml(link, "Added this print profile's file to the model you already had.", "Profile added"));
    } else if (print?.import_outcome === "already_imported") {
      renderPanel(successHtml(link, "This print profile's file was already on the model -- nothing new was added.", "Already in your library"));
    } else {
      renderPanel(successHtml(link));
    }
  } catch (err) {
    renderPanel(errorHtml(err));
  }
}
