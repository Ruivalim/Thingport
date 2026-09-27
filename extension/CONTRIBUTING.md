# Developing Thingport Grab

How to work on the Thingport Grab browser extension: running it locally, how the code is laid out,
building and packaging it for each browser's store, and how releases are signed. What the extension
does and how to install it is in the **[README](README.md)**; the branch, commit and pull request
workflow shared by the whole repo is in the root **[CONTRIBUTING.md](../CONTRIBUTING.md)**.

## Getting started

The extension is TypeScript, bundled with [esbuild](https://esbuild.github.io/), with styles in
SCSS. You need Node.js 20 or newer. Everything below runs from this `extension/` folder:

```bash
npm install
npm run dev            # build dist/chrome and rebuild on every change
npm run dev:firefox    # same for dist/firefox
```

Load the build output as an unpacked extension, and reload it (the circular arrow on its card in
`chrome://extensions`, or **Reload** in `about:debugging`) after a rebuild:

- **Chrome / Edge**: `chrome://extensions` -> **Developer mode** -> **Load unpacked** -> `dist/chrome`
  (or `dist/edge`).
- **Firefox**: `about:debugging#/runtime/this-firefox` -> **Load Temporary Add-on** ->
  `dist/firefox/manifest.json`.

### Layout

```
src/
  shared/       code used by more than one script: storage keys, provider URL matching,
                the typed message protocol (messages.ts), API types, the inline icon
  background/   background script -- config/auth, every request to the Thingport instance,
                imports, the guided MakerWorld collection job, recent imports, toolbar icon
  content/      content script -- the floating icon, its panel flows (panels/), the setup dialog,
                overlays, MakerWorld page-data and download-URL resolution (makerworld/)
    styles/     its SCSS, compiled into the bundle and injected into its shadow root
  popup/        toolbar popup (popup.html, its script and styles/)
  styles/       SCSS design tokens and mixins shared by the popup and the content UI
  assets/       the Thingport icon SVG (inlined into the bundles)
public/         copied into every build as-is (the toolbar icon PNGs)
scripts/        build.ts, manifest.ts (per-browser manifest), zip.ts, screenshots.ts
```

The content script and the popup never call the Thingport instance themselves: they send a
message to the background script, which owns the credentials and the instance's host permission.
Every message and its reply is typed in `src/shared/messages.ts`.

Colors, spacing and type live in `src/styles/_tokens.scss`. Colors are CSS custom properties with a
light and a dark palette: the popup follows the browser's color scheme, while the in-page UI always
uses the light one.

### Before opening a pull request

- `npm run verify` passes (typecheck, lint, all three builds).
- The change works in Chrome **and** Firefox: load `dist/chrome` and `dist/firefox` and try it on
  the provider pages it touches. The background runs as a service worker in Chrome/Edge but as an
  event page in Firefox, so keep top-level background code free of anything only one supports.
- If it changes anything visible, run `npm run screenshots` and commit the updated images.
- If it adds a runtime message, add it to `src/shared/messages.ts` so both ends stay typed.
- Provider URL patterns in `src/shared/urls.ts` are duplicated from the web app and backend (see
  the comment there) -- change them in all three places.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `dev:firefox` | Watch build of `dist/chrome` / `dist/firefox` |
| `npm run build` | Builds `dist/chrome`, `dist/firefox` and `dist/edge` |
| `npm run build:chrome` / `build:firefox` / `build:edge` | Builds one browser |
| `npm run zip` | Builds everything and packages the store zips (below) |
| `npm run zip:chrome` / `zip:firefox` / `zip:edge` | Same for one store |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | oxlint (also run on commit by the repo's pre-commit hook) |
| `npm run lint:firefox` | Builds for Firefox and runs `web-ext lint` on the result |
| `npm run screenshots` | Regenerates the README screenshots (see below) |
| `npm run verify` | Typecheck + lint + build |

The only difference between the browser builds is `manifest.json` (see `scripts/manifest.ts`):
Chrome and Edge run the background as a service worker, Firefox as an event page
(`background.scripts`) with its `browser_specific_settings.gecko` block. The version comes from
`package.json`.

## Store submission

`npm run zip` writes one upload-ready zip per store to `dist/zips/`, each with `manifest.json` at
its root:

| File | Where it goes |
| --- | --- |
| `thingport-grab-chrome.zip` | [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) |
| `thingport-grab-edge.zip` | [Microsoft Edge Add-ons Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) |
| `thingport-grab-firefox.zip` | [addons.mozilla.org Developer Hub](https://addons.mozilla.org/developers/) |
| `thingport-grab-sources.zip` | AMO too -- it asks for the source whenever the submitted code comes out of a build step |

The bundles aren't minified, so reviewers can read them as-is; the sources zip lets them rebuild
them byte-for-byte with `npm ci && npm run build:firefox`. Bump `version` in `package.json` before
submitting an update -- every store rejects a version it has already seen.

The screenshots in `docs/screenshots/` double as store listing images.

### Regenerating the screenshots

```bash
npx playwright install chromium   # once
npm run screenshots
```

This builds the Chrome version, opens a Chromium window with it loaded (visible, not headless:
Printables' Cloudflare check turns headless browsers away), and serves a small mock Thingport
instance locally so the popup and panels show realistic data without a real account. The provider
pages are the live sites -- by default the first models linked from each site's front page; pass
`-- --makerworld=<url> --thingiverse=<url> --printables=<url>` to pick specific ones.

## Releases (CI)

`.github/workflows/extension-release.yml` runs on every push and pull request touching this folder:
typecheck, lint, the Chrome/Edge build, and `web-ext lint` on the Firefox build. On a push to `main`
it also signs the Firefox build through AMO's unlisted channel and publishes
`thingport-grab-chrome.zip`, `thingport-grab-edge.zip` and `thingport-grab-firefox.xpi` to the
`extension-latest` release (the in-app Download page links there).

AMO rejects re-uploading a version number it has already seen for this add-on ID (even on the
unlisted channel), so CI signs a copy of the built manifest with the run number appended to the
version (e.g. `1.1.0.456`) rather than requiring a version bump on every commit.

To produce a signed Firefox build by hand, you need a Mozilla Add-on Developer account's API
credentials (see below), and `version` in `package.json` bumped past the last signed one:

```bash
npm run build:firefox
npx web-ext sign --source-dir dist/firefox --channel unlisted \
  --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET"
```

### One-time setup: AMO signing credentials

Firefox requires every extension -- even self-distributed, unlisted ones -- to be signed by
Mozilla before it will install. The workflow needs two repo secrets to do this automatically:

1. Create a free account at [addons.mozilla.org](https://addons.mozilla.org) if you don't have one.
2. Go to [Manage API Keys](https://addons.mozilla.org/en-US/developers/addon/api/key/) and generate
   a new API key/secret pair.
3. In the GitHub repo, add them as **Settings > Secrets and variables > Actions** secrets named
   `AMO_JWT_ISSUER` (the API key) and `AMO_JWT_SECRET` (the API secret).

No manual submission through the AMO web UI is needed first -- `web-ext sign --channel unlisted`
creates the add-on listing (hidden, unlisted) on its first run.

The extension's Firefox identity (`browser_specific_settings.gecko.id` in `scripts/manifest.ts`,
currently `grab@thingport.app`) is what ties every signed version together as updates to the same
add-on -- changing it later creates an unrelated add-on from Mozilla's point of view, so avoid
changing it once builds have been signed and distributed.

`browser_specific_settings.gecko.data_collection_permissions` is declared as `["none"]` -- Mozilla
requires every add-on to disclose this (as of policy effective 2025-11-03) and rejects signing
without it. This only covers data sent *off-device to the extension's developer or a third party
it controls* -- the credentials/cookies this extension sends to your own self-hosted Thingport
instance don't count, since that's a destination you configure and control, not the developer. If
that ever changes (e.g. adding telemetry to a Thingport-operated service), update this declaration
to match.

## Regenerating the icons

The toolbar icon PNGs (`public/icons/thingport-icon-{color,dark}-{16,32,48,128}.png`) and
`src/assets/thingport-icon-color.svg` (inlined into the popup header and the in-page UI) are
rendered once from `frontend/src/assets/logos/thingport-icon-{color,dark}.svg` and checked in
rather than built on the fly -- with a tighter `viewBox` than the source files use. The source
SVGs' own 80x80 canvas leaves a fairly generous margin around the glyph (fine at logo size, but at
a 16-19px toolbar icon it reads as "too small" -- most of the square is empty). This crops to the
glyph's actual bounding box (including its stroke width) plus a small ~6% padding: `4 4 72 72`
instead of `0 0 80 80`. Regenerate (e.g. after the source SVGs change) from the repo root -- if the
glyph's proportions change, recompute the crop rather than reusing `4 4 72 72` as-is:

```bash
node -e "
const sharp = require('./backend/node_modules/sharp');
const fs = require('fs');
const sizes = [16, 32, 48, 128];
const jobs = [
  ['frontend/src/assets/logos/thingport-icon-color.svg', 'extension/public/icons/thingport-icon-color', 'extension/src/assets/thingport-icon-color.svg'],
  ['frontend/src/assets/logos/thingport-icon-dark.svg', 'extension/public/icons/thingport-icon-dark', null],
];
(async () => {
  for (const [src, outBase, svgOut] of jobs) {
    const svg = fs.readFileSync(src, 'utf8').replace('viewBox=\"0 0 80 80\"', 'viewBox=\"4 4 72 72\"');
    if (svgOut) fs.writeFileSync(svgOut, svg);
    for (const size of sizes) {
      await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(\`\${outBase}-\${size}.png\`);
    }
  }
})();
"
```
