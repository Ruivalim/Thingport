// The "Add to collection" picker on single-model imports (batch imports get their own auto-named
// collection), and the find-or-create both of them file into.

import type { Collection } from "../../shared/api";
import { api, escapeHtml } from "../runtime";
import { panelQuery } from "../shell";

const NEW_COLLECTION = "__new__";

/** Case-insensitive match on name, created if missing. Null on failure; the import proceeds. */
export async function findOrCreateCollection(name: string | null): Promise<string | null> {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  try {
    const collections = await api<Collection[]>("GET", "/collections");
    const existing = collections.find((c) => !c.system_key && (c.name || "").trim().toLowerCase() === normalized);
    if (existing) return existing.id;
    return (await api<Collection>("POST", "/collections", { name: trimmed })).id;
  } catch {
    return null;
  }
}

/** Call wireCollectionPicker() once it's rendered. */
export async function collectionPickerHtml(): Promise<string> {
  try {
    const collections = await api<Collection[]>("GET", "/collections");
    const options = collections
      .filter((c) => !c.system_key)
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
      .join("");
    // <hr> draws a divider in the dropdown; browsers too old for that drop it.
    return `
      <label class="tg-label" for="tg-collection">Add to collection (optional)</label>
      <select id="tg-collection" class="tg-select">
        <option value="">No collection</option>
        <hr />
        ${options ? `${options}<hr />` : ""}
        <option value="${NEW_COLLECTION}">Create new collection</option>
      </select>
      <div id="tg-new-collection-row" hidden>
        <label class="tg-label" for="tg-new-collection">New collection name</label>
        <input id="tg-new-collection" class="tg-input" type="text" maxlength="200" autocomplete="off" />
      </div>
    `;
  } catch {
    return ""; // import still works without the picker
  }
}

/** Shows the name field while "Create new collection" is picked. */
export function wireCollectionPicker(): void {
  const select = panelQuery<HTMLSelectElement>("#tg-collection");
  const row = panelQuery<HTMLElement>("#tg-new-collection-row");
  const input = panelQuery<HTMLInputElement>("#tg-new-collection");
  if (!select || !row || !input) return;
  select.addEventListener("change", () => {
    const creating = select.value === NEW_COLLECTION;
    row.hidden = !creating;
    input.required = creating;
    if (creating) input.focus();
  });
}

export type CollectionChoice = { id: string } | { newName: string } | null;

/** Read when the import starts, before SPA navigation can clear the panel. "missing-name" means
 *  "Create new collection" has no name yet; the field says so and the import should wait. */
export function readCollectionChoice(): CollectionChoice | "missing-name" {
  const select = panelQuery<HTMLSelectElement>("#tg-collection");
  if (!select || !select.value) return null;
  if (select.value !== NEW_COLLECTION) return { id: select.value };
  const input = panelQuery<HTMLInputElement>("#tg-new-collection");
  const name = input?.value.trim() ?? "";
  if (!name) {
    input?.reportValidity();
    input?.focus();
    return "missing-name";
  }
  return { newName: name };
}

/** A new name files into the collection already called that, if there is one. */
export async function collectionIdFor(choice: CollectionChoice): Promise<string | null> {
  if (!choice) return null;
  return "id" in choice ? choice.id : findOrCreateCollection(choice.newName);
}
