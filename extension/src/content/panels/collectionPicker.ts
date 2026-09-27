// "Add to collection" picker -- single-model imports only; a batch import lands in Thingport's own
// auto-named collection for that batch, matching the web app.

import type { Collection } from "../../shared/api";
import { api, escapeHtml } from "../runtime";
import { panelQuery } from "../shell";

export async function collectionPickerHtml(): Promise<string> {
  try {
    const collections = await api<Collection[]>("GET", "/collections");
    const options = collections
      .filter((c) => !c.system_key)
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
      .join("");
    return `
      <label class="tg-label" for="tg-collection">Add to collection (optional)</label>
      <select id="tg-collection" class="tg-select"><option value="">No collection</option>${options}</select>
    `;
  } catch {
    return ""; // Collections failed to load -- import still works without the picker.
  }
}

export function selectedCollectionId(): string | null {
  const select = panelQuery<HTMLSelectElement>("#tg-collection");
  return select && select.value ? select.value : null;
}
