import { ctx } from "../context";
import { loadBatchEntries } from "./batch";
import { loadMakerworldGuidedCollection } from "./makerworldCollection";
import { loadSingleItem } from "./single";

export async function loadPanel(): Promise<void> {
  const { kind, provider } = ctx().classification;
  if (kind === "single") await loadSingleItem();
  else if (provider === "makerworld") await loadMakerworldGuidedCollection();
  else await loadBatchEntries();
}
