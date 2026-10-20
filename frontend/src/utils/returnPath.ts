// A page someone reached signed out, to return to after single sign-on, which goes through the provider and
// would otherwise land on the home page. Thingport Grab's approval page and the bookmarklet's import link need it.

const KEY = "thingport_return_to";
const RETURNABLE = ["/connect-grab", "/import"];

export function rememberReturnPath(): void {
  try {
    if (RETURNABLE.includes(window.location.pathname)) {
      window.sessionStorage.setItem(KEY, window.location.pathname + window.location.search);
    }
  } catch {}
}

/** The remembered page, once; null when there's none. */
export function takeReturnPath(): string | null {
  try {
    const path = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return path && RETURNABLE.some((returnable) => path.startsWith(`${returnable}?`)) ? path : null;
  } catch {
    return null;
  }
}
