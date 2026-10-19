/** Where the bookmarklet sends a page's link: the import dialog opens filled in with `?url=`. */
export const IMPORT_PATH = "/import";

/** A bookmark that opens this Thingport's import dialog with the current page's link. Falls back to
 *  navigating the page itself when the site or the browser stops the new tab from opening. */
export function buildBookmarklet(origin: string): string {
  const target = JSON.stringify(`${origin}${IMPORT_PATH}?url=`);
  return `javascript:(()=>{const u=${target}+encodeURIComponent(location.href);window.open(u,"_blank")||(location.href=u)})()`;
}

/** The link the bookmarklet opened Thingport with, or null when this isn't that page. */
export function readImportLink(pathname: string, search: string): string | null {
  if (pathname !== IMPORT_PATH) return null;
  return new URLSearchParams(search).get("url")?.trim() ?? "";
}
