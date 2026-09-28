/** Prefixes the base path to a site-internal route like `docs/install/`. */
export function url(route = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  return base + route.replace(/^\//, "");
}

export const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
