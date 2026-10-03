import { expect, test } from "@playwright/test";
import { apiGet, authToken, uploadCube } from "./helpers";

test("uploads an STL, renames it and deletes it", async ({ page, request }) => {
  await page.goto("/models");
  const printId = await uploadCube(page);

  const dialog = page.getByRole("dialog", { name: "Edit model" });
  await dialog.getByLabel("Title").fill("Regression Cube");
  await dialog.getByRole("button", { name: "Update" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Regression Cube" })).toBeVisible();

  const token = await authToken(page);
  const print = await apiGet(request, token, `/api/print/${printId}`);
  expect(print.title).toBe("Regression Cube");

  await page.goto("/models");
  await expect(page.getByText("Regression Cube")).toBeVisible();

  await page.goto(`/models/${printId}`);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForURL((url) => !url.pathname.includes(printId));

  const res = await request.get(`/api/print/${printId}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(404);
});

test("switching to Folders while the saved view is still loading isn't undone", async ({ page }) => {
  // Answer the saved-view request with the server's (old) value, but only after the switch.
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  await page.route("**/api/settings/categories-view", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const stale = await route.fetch();
    await released;
    await route.fulfill({ response: stale });
  });

  await page.goto("/models");
  const main = page.getByRole("main");
  const panelTitle = main.getByRole("heading", { level: 6 }).nth(1);
  await main.getByRole("button", { name: "Folders", exact: true }).click();
  await expect(panelTitle).toHaveText("Folders");

  const answered = page.waitForResponse((r) => r.url().endsWith("/api/settings/categories-view"));
  release();
  await answered;
  await expect(main.getByRole("button", { name: "Folders", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(panelTitle).toHaveText("Folders");

  // The choice is saved on the account; put it back for the other specs.
  await page.unroute("**/api/settings/categories-view");
  await main.getByRole("button", { name: "Categories", exact: true }).click();
  await expect(panelTitle).toHaveText("Categories");
});
