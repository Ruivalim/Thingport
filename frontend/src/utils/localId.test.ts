import { afterEach, describe, expect, it, vi } from "vitest";
import { newLocalId } from "./localId";

describe("newLocalId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("works without crypto.randomUUID (insecure HTTP origins)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const a = newLocalId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newLocalId()).not.toBe(a);
  });
});
