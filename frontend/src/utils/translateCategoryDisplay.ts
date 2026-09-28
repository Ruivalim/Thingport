import type { i18n as I18n } from "i18next";
import type { Category } from "../api/categories";

export type CategoryDisplayText = {
  name: string;
  metaTitle: string | null;
  metaDescription: string | null;
};

type DefaultCategoryText = { name: string; metaTitle: string; metaDescription: string };

function firstMakerworldCatId(category: Category): number | null {
  const first = category.makerworld_cat_ids.split(";")[0]?.trim();
  if (!first) return null;
  const id = Number(first);
  return Number.isFinite(id) ? id : null;
}

/** Both locales are always loaded, so English is available as reference text. */
function defaultCategoryText(i18n: I18n, lng: string, id: number): DefaultCategoryText | undefined {
  return i18n.getResourceBundle(lng, "models")?.defaultCategories?.[id];
}

/** Shows the Lithuanian text for a starter category field only while it still matches the original
 * English verbatim (i.e. the user hasn't edited it). Each field is checked independently. */
export function translateCategoryDisplay(category: Category, i18n: I18n): CategoryDisplayText {
  const stored: CategoryDisplayText = {
    name: category.name,
    metaTitle: category.meta_title,
    metaDescription: category.meta_description,
  };

  const lang = i18n.language.slice(0, 2).toLowerCase();
  if (lang !== "lt") return stored;

  const id = firstMakerworldCatId(category);
  if (id === null) return stored;
  const en = defaultCategoryText(i18n, "en", id);
  const lt = defaultCategoryText(i18n, "lt", id);
  if (!en || !lt) return stored;

  return {
    name: category.name === en.name ? lt.name : category.name,
    metaTitle: category.meta_title === en.metaTitle ? lt.metaTitle : category.meta_title,
    metaDescription: category.meta_description === en.metaDescription ? lt.metaDescription : category.meta_description,
  };
}
