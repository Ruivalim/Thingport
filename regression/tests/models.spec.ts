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
