// @ts-check
import { copyFile } from "node:fs/promises";
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
  integrations: [
    sitemap({ filter: (page) => !page.endsWith("/404/") }),
    // Search Console and crawlers try /sitemap.xml first; the integration only writes sitemap-index.xml.
    {
      name: "sitemap-xml-alias",
      hooks: {
        "astro:build:done": async ({ dir }) => {
          await copyFile(new URL("sitemap-index.xml", dir), new URL("sitemap.xml", dir));
        },
      },
    },
  ],
  markdown: {
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
    // The unified pipeline, needed for this plugin.
    processor: unified({ rehypePlugins: [[rehypeRepoLinks, { base }]] }),
  },
  // Docs, logos and screenshots are used from elsewhere in the repo. Favicons must be real files,
  // since search engines ignore data: URIs.
  vite: { server: { fs: { allow: [".."] } }, build: { assetsInlineLimit: 0 } },
});
