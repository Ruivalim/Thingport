// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import { rehypeRepoLinks } from "./src/lib/rehypeRepoLinks.mjs";

// SITE_URL and BASE_PATH override the custom domain, e.g.
// SITE_URL=https://tautvydasderzinskas.github.io BASE_PATH=/Thingport for a project-path build.
const site = process.env.SITE_URL || "https://thingport.net";
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  integrations: [sitemap({ filter: (page) => !page.endsWith("/404/") })],
  markdown: {
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
    // The unified pipeline, needed for this plugin.
    processor: unified({ rehypePlugins: [[rehypeRepoLinks, { base }]] }),
  },
  // Docs, logos and screenshots are used from elsewhere in the repo. Favicons must be real files,
  // since search engines ignore data: URIs.
  vite: { server: { fs: { allow: [".."] } }, build: { assetsInlineLimit: 0 } },
});
