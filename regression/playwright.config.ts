import { defineConfig, devices } from "@playwright/test";

export const ADMIN_STATE = ".auth/admin.json";

export default defineConfig({
  testDir: "tests",
  // Scenarios share one database, and the first account registered becomes the admin.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8090",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
      dependencies: ["setup"],
    },
  ],
});
