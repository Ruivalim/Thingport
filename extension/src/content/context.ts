import type { Classification } from "../shared/urls";

/** Set when the model is already in the library but this page's MakerWorld print profile might
 *  not be (see the backend's checkImportStatus) -- the icon and panel then offer to add the
 *  profile's file to the existing model rather than presenting it as a new import. */
export type LibraryState = { state: "profile_missing" | "profile_unknown"; printId: string | null };

/** Everything the panel's flows need to know about the page the icon is showing on. Set once per
 *  page by index.ts's init() (title is filled in later, from /import/inspect or the page). */
export type ImportContext = {
  url: string;
  instanceUrl: string;
  classification: Classification;
  library: LibraryState | null;
  title?: string | null;
};

let current: ImportContext | null = null;

export function setContext(context: ImportContext | null): void {
  current = context;
}

/** The current page's context. Throws once the page has changed underneath a still-running flow
 *  (an SPA navigation calls unmount(), which clears it) -- flows that must survive that capture
 *  what they need up front instead. */
export function ctx(): ImportContext {
  if (!current) throw new Error("The page changed while this was running");
  return current;
}
