#!/usr/bin/env node
// Captures the README and website screenshots (frontend/src/assets/screenshots) from a running
// instance with a populated library. The extension's screenshots aren't covered.
//
//   npm --prefix regression run screenshots -- --url https://thingport.example --email me@example.com
//
// The password comes from THINGPORT_PASSWORD (or --password). Options, also settable as env vars:
//   --url       THINGPORT_URL       instance to capture (required)
//   --email     THINGPORT_EMAIL     account to sign in with (required)
//   --password  THINGPORT_PASSWORD
//   --model     SCREENSHOT_MODEL    search text picking the model for the details and 3D shots
//   --only      SCREENSHOT_ONLY     comma-separated shot names or numbers, e.g. 03,04
//   --out       SCREENSHOT_OUT      output folder
//   --headed                        show the browser
//
// The account's theme and Categories/Folders choice are switched for the shots and restored afterwards.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
    model: { type: "string" },
    only: { type: "string" },
    out: { type: "string" },
    headed: { type: "boolean", default: false },
  },
});

const baseUrl = (args.url || process.env.THINGPORT_URL || "").replace(/\/+$/, "");
const email = args.email || process.env.THINGPORT_EMAIL;
const password = args.password || process.env.THINGPORT_PASSWORD;
const modelQuery = args.model || process.env.SCREENSHOT_MODEL || "Adjustable Telescopic Wall Hook";
const outDir = path.resolve(
  args.out || process.env.SCREENSHOT_OUT || path.join(here, "../frontend/src/assets/screenshots"),
);
const only = (args.only || process.env.SCREENSHOT_ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!baseUrl || !email || !password) {
  console.error("Needs --url, --email and THINGPORT_PASSWORD (or --password). See the header of this file.");
  process.exit(1);
}

// 1400x790 at 2x, the size the README and site layouts were made for.
const VIEWPORT = { width: 1400, height: 790 };

/** Waits for the page's requests and every visible image, so no shot has half-loaded cards. */
async function settle(page, extraMs = 800) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 15000 })
    .catch(() => console.warn("  some images were still loading"));
  await page.waitForTimeout(extraMs);
}

// Opening menus can nudge the page; the shots should start at the top.
async function scrollToTop(page) {
  await page.evaluate(() => {
    for (const el of [document.scrollingElement, ...document.querySelectorAll("*")]) {
      if (el && el.scrollTop) el.scrollTop = 0;
    }
  });
}

async function openUserMenu(page, displayName) {
  await page.getByRole("button", { name: displayName }).click();
  await page.getByRole("menuitem", { name: "Theme" }).waitFor();
}

const SHOTS = [
  {
    name: "01_dashboard",
    run: async (page) => {
      await page.goto("/");
    },
  },
  {
    name: "02_models",
    run: async (page) => {
      await page.goto("/models");
    },
  },
  {
    name: "03_model_details",
    needsModel: true,
    run: async (page, ctx) => {
      await page.goto(`/models/${ctx.modelId}`);
    },
  },
  {
    name: "04_model_details_3d_preview",
    needsModel: true,
    run: async (page, ctx) => {
      await page.goto(`/models/${ctx.modelId}`);
      await settle(page);
      await page.getByRole("button", { name: "3D Preview" }).click();
      await page.locator("canvas").first().waitFor();
      // The model streams in and the camera eases to fit it.
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.waitForTimeout(4000);
    },
  },
  {
    name: "05_collections",
    run: async (page) => {
      await page.goto("/models/collections");
    },
  },
  {
    name: "06_tags",
    run: async (page) => {
      await page.goto("/models/tags");
    },
  },
  {
    name: "07_downloads",
    run: async (page) => {
      await page.goto("/downloads");
    },
  },
  {
    name: "08_my_models",
    run: async (page, ctx) => {
      await page.goto("/");
      await settle(page, 0);
      await openUserMenu(page, ctx.displayName);
      await page.getByRole("menuitem", { name: "My models" }).click();
      await settle(page);
      await openUserMenu(page, ctx.displayName);
      await scrollToTop(page);
    },
  },
  {
    name: "09_dark_theme",
    run: async (page, ctx) => {
      await page.goto("/models");
      await settle(page, 0);
      await openUserMenu(page, ctx.displayName);
      await page.getByRole("menuitem", { name: "Theme" }).click();
      await page.getByRole("menuitem", { name: "Dark" }).click();
      await page.keyboard.press("Escape");
      await settle(page, 0);
      // Shown with the choice that made it: the user menu and its theme list.
      await openUserMenu(page, ctx.displayName);
      await page.getByRole("menuitem", { name: "Theme" }).click();
      await page.getByRole("menuitem", { name: "Dark" }).waitFor();
      await scrollToTop(page);
    },
  },
];

function wanted(shot) {
  if (!only.length) return true;
  return only.some((o) => shot.name === o || shot.name.startsWith(`${o}_`) || shot.name.split("_")[0] === o);
}

// Through the browser context, so a self-signed certificate is accepted the same way.
async function api(token, method, url, body) {
  const res = await context.request.fetch(`${baseUrl}/api${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  if (!res.ok()) throw new Error(`${method} ${url}: ${res.status()} ${await res.text()}`);
  return res.json();
}

const browser = await chromium.launch({ headless: !args.headed });
const context = await browser.newContext({
  baseURL: baseUrl,
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  locale: "en-US",
  colorScheme: "light",
  // Self-hosted instances often run on a self-signed certificate.
  ignoreHTTPSErrors: true,
});
// English UI and an expanded sidebar, whatever this browser profile last had.
await context.addInitScript(() => {
  localStorage.setItem("thingport_language", "en");
  localStorage.setItem("thingport_sidebar_collapsed", "false");
});
const page = await context.newPage();

let token = null;
let originalTheme;
let originalView;
try {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).waitFor();
  token = await page.evaluate(() => localStorage.getItem("thingport_auth_token"));
  const user = JSON.parse((await page.evaluate(() => localStorage.getItem("thingport_auth_user"))) || "{}");
  const displayName = user.display_name || user.displayName;
  if (!token || !displayName) throw new Error("Signed in, but couldn't read the session from the page");

  originalTheme = (await api(token, "GET", "/settings/theme")).theme;
  await api(token, "PATCH", "/settings/theme", { theme: "light" });
  // The models page shows the category tree, not folders.
  originalView = (await api(token, "GET", "/settings/categories-view")).view;
  await api(token, "PATCH", "/settings/categories-view", { view: "categories" });
  await page.reload();

  const found = await api(token, "GET", `/prints?q=${encodeURIComponent(modelQuery)}&limit=1`);
  const modelId = found[0]?.id;
  if (!modelId && SHOTS.some((shot) => wanted(shot) && shot.needsModel)) {
    throw new Error(`No model matches "${modelQuery}"; pick one with --model`);
  }

  const ctx = { displayName, modelId };
  for (const shot of SHOTS.filter(wanted)) {
    process.stdout.write(`${shot.name}... `);
    await shot.run(page, ctx);
    await settle(page);
    await page.screenshot({ path: path.join(outDir, `${shot.name}.png`) });
    console.log("done");
    await page.keyboard.press("Escape").catch(() => undefined);
  }
  console.log(`Saved to ${outDir}`);
} finally {
  if (token && originalTheme !== undefined) {
    await api(token, "PATCH", "/settings/theme", { theme: originalTheme }).catch((err) =>
      console.error(`Couldn't restore the account's theme (${originalTheme}): ${err.message}`),
    );
  }
  if (token && originalView !== undefined) {
    await api(token, "PATCH", "/settings/categories-view", { view: originalView }).catch((err) =>
      console.error(`Couldn't restore the Categories/Folders choice (${originalView}): ${err.message}`),
    );
  }
  await browser.close();
}
