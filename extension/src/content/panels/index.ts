import { ctx } from "../context";
import { loadBatchEntries } from "./batch";
import { loadMakerworldGuidedCollection } from "./makerworldCollection";
import { loadSingleItem } from "./single";

/** Loads the panel's first step for the current page, the first time the panel is opened. */
export async function loadPanel(): Promise<void> {
  const { kind, provider } = ctx().classification;
  if (kind === "single") await loadSingleItem();
  else if (provider === "makerworld") await loadMakerworldGuidedCollection();
  else await loadBatchEntries();
}
