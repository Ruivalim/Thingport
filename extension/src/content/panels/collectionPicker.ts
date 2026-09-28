// Single-model imports only; batch imports get their own auto-named collection.

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
    return ""; // import still works without the picker
  }
}

export function selectedCollectionId(): string | null {
  const select = panelQuery<HTMLSelectElement>("#tg-collection");
  return select && select.value ? select.value : null;
}
