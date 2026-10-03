import { expect, test } from "@playwright/test";
import { ADMIN } from "./helpers";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid email or password");
  });

  test("signs in with the right password", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  });
});

test("logs out", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: ADMIN.displayName }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  // The session is gone, not just hidden.
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
