import { expect, test as setup } from "@playwright/test";
import { ADMIN_STATE } from "../playwright.config";
import { ADMIN } from "./helpers";

// On an empty instance the first account registers as admin, with no email verification.
setup("bootstrap the admin account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Register" }).click();
  await page.getByLabel("Display Name").fill(ADMIN.displayName);
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel(/^Password/).fill(ADMIN.password);
  await page.getByLabel("Confirm Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
