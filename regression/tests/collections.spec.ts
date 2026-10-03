import { expect, test } from "@playwright/test";
import { uploadCube } from "./helpers";

test("creates a collection and adds a model to it", async ({ page }) => {
  await page.goto("/models/collections");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "New Collection" }).click();
  const form = page.getByRole("dialog", { name: "New Collection" });
  await form.getByLabel("Name").fill("Regression Shelf");
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText("Regression Shelf")).toBeVisible();

  await uploadCube(page);
  await page.getByRole("dialog", { name: "Edit model" }).getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Add to collection" }).click();
  const picker = page.getByRole("dialog", { name: "Add to collection" });
  await picker.getByRole("button", { name: "Regression Shelf" }).click();
  await expect(picker.getByTestId("CheckIcon")).toBeVisible();
  await picker.getByRole("button", { name: "Close" }).click();

  await page.goto("/models/collections");
  // Innermost element holding both the name and a count; Browsing History also shows "1 model" now.
  const shelf = page
    .locator("div")
    .filter({ has: page.getByText("Regression Shelf", { exact: true }) })
    .filter({ hasText: /\d+ models?/ })
    .last();
  await expect(shelf).toContainText("1 model");
});
