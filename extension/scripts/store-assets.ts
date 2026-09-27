// Renders the store listing images from the HTML templates in store-assets/ into docs/store/:
//
//   npm run store-assets
//
//   logo.png        300x300    store logo (Edge Add-ons "Extension logo")
//   tile-small.png  440x280    small promotional tile
//   tile-large.png  1400x560   large promotional tile (the extension's real panel on a placeholder page)
//   screenshots/*.png 1280x800 the README's page screenshots (docs/screenshots/*.jpg) as PNG, at the
//                              stores' screenshot size -- run `npm run screenshots` first to refresh them
//
// Needs Playwright's Chromium once: `npx playwright install chromium`.

import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import * as sass from "sass";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = path.join(ROOT, "store-assets");
const OUT_DIR = path.join(ROOT, "docs", "store");
const SCREENSHOTS_DIR = path.join(ROOT, "docs", "screenshots");
const STORE_SCREENSHOT = { width: 1280, height: 800 };

// The content script's real stylesheet, for templates that show the in-page UI (tile-large.html).
// It's written for a shadow root, so its `:host` custom properties are re-scoped to `.tg-scope`.
// Transitions are switched off: the stylesheet lands after the page has rendered, and a button
// would otherwise be captured mid-fade from its default gray to green.
const CONTENT_CSS =
  sass.compile(path.join(ROOT, "src", "content", "styles", "content.scss")).css.replaceAll(":host", ".tg-scope") +
  "\n*, *::before, *::after { transition: none !important; }";

const ASSETS = [
  { template: "logo.html", out: "logo.png", width: 300, height: 300 },
  { template: "tile-small.html", out: "tile-small.png", width: 440, height: 280 },
  { template: "tile-large.html", out: "tile-large.png", width: 1400, height: 560 },
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
try {
  for (const asset of ASSETS) {
    // deviceScaleFactor 1: the stores want these exact pixel sizes.
    const page = await browser.newPage({ viewport: { width: asset.width, height: asset.height }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(TEMPLATES, asset.template)).href, { waitUntil: "load" });
    await page.addStyleTag({ content: CONTENT_CSS });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_DIR, asset.out) });
    await page.close();
    console.log(`docs/store/${asset.out}  ${asset.width}x${asset.height}`);
  }

  // The stores only take PNG screenshots, at 1280x800 (the README's are 2x JPEGs).
  await mkdir(path.join(OUT_DIR, "screenshots"), { recursive: true });
  const page = await browser.newPage({ viewport: STORE_SCREENSHOT, deviceScaleFactor: 1 });
  for (const file of (await readdir(SCREENSHOTS_DIR)).filter((f) => f.endsWith(".jpg")).toSorted()) {
    const dataUrl = `data:image/jpeg;base64,${(await readFile(path.join(SCREENSHOTS_DIR, file))).toString("base64")}`;
    await page.setContent(
      `<body style="margin:0"><img src="${dataUrl}" style="display:block;width:${STORE_SCREENSHOT.width}px;height:${STORE_SCREENSHOT.height}px"></body>`,
      { waitUntil: "load" },
    );
    const out = `screenshots/${file.replace(/\.jpg$/, ".png")}`;
    await page.screenshot({ path: path.join(OUT_DIR, out) });
    console.log(`docs/store/${out}  ${STORE_SCREENSHOT.width}x${STORE_SCREENSHOT.height}`);
  }
  await page.close();
} finally {
  await browser.close();
}
