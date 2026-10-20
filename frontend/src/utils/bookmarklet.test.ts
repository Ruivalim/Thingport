import { describe, expect, it, vi } from "vitest";
import { buildBookmarklet, readImportLink } from "./bookmarklet";

describe("buildBookmarklet", () => {
  it("opens this Thingport's import page with the current page's link", () => {
    const code = buildBookmarklet("https://thingport.example.com");
    expect(code.startsWith("javascript:")).toBe(true);
    const open = vi.fn<(url: string, target: string) => object>(() => ({}));
    const location = { href: "https://makerworld.com/en/models/123?from=a&b=c" };
    new Function("window", "location", code.slice("javascript:".length))({ open }, location);
    expect(open).toHaveBeenCalledWith(
      `https://thingport.example.com/import?url=${encodeURIComponent(location.href)}`,
      "_blank",
    );
  });

  it("navigates the page itself when the new tab is blocked", () => {
    const location = { href: "https://www.printables.com/model/1" };
    new Function("window", "location", buildBookmarklet("http://nas:8080").slice("javascript:".length))(
      { open: () => null },
      location,
    );
    expect(location.href).toBe(
      `http://nas:8080/import?url=${encodeURIComponent("https://www.printables.com/model/1")}`,
    );
  });
});

describe("readImportLink", () => {
  it("reads the link off the import page only", () => {
    expect(readImportLink("/import", `?url=${encodeURIComponent("https://www.thingiverse.com/thing:1")}`)).toBe(
      "https://www.thingiverse.com/thing:1",
    );
    expect(readImportLink("/import", "")).toBe("");
    expect(readImportLink("/models", "?url=x")).toBeNull();
  });
});
