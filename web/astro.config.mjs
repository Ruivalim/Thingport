// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import { rehypeRepoLinks } from "./src/lib/rehypeRepoLinks.mjs";

// Defaults to the custom domain set in the repo's Pages settings. SITE_URL and BASE_PATH override them, e.g.
// SITE_URL=https://tautvydasderzinskas.github.io BASE_PATH=/Thingport for a project-path build.
const site = process.env.SITE_URL || "https://thingport.net";
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  integrations: [sitemap({ filter: (page) => !page.endsWith("/404/") })],
  markdown: {
    // Both themes are emitted as CSS variables; global.css picks one per colour scheme.
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
    // The unified (remark/rehype) pipeline, not Astro's default one, because of this plugin.
    processor: unified({ rehypePlugins: [[rehypeRepoLinks, { base }]] }),
  },
  // The docs, logos, fonts and screenshots live elsewhere in the repo and are used from there.
  // assetsInlineLimit 0: favicons must be real files (search engines ignore data: URI favicons).
  vite: { server: { fs: { allow: [".."] } }, build: { assetsInlineLimit: 0 } },
});
