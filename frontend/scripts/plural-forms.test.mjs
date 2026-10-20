import { describe, expect, it } from "vitest";
import { pluralForms } from "./plural-forms.mjs";

describe("pluralForms", () => {
  it("includes forms only large round counts use", () => {
    expect([...pluralForms("fr")].toSorted()).toEqual(["many", "one", "other"]);
    expect([...pluralForms("es")].toSorted()).toEqual(["many", "one", "other"]);
  });

  it("leaves out fractional-only forms", () => {
    expect([...pluralForms("lt")].toSorted()).toEqual(["few", "one", "other"]);
    expect([...pluralForms("en")].toSorted()).toEqual(["one", "other"]);
  });
});
