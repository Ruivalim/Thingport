// Shared by astro.config.mjs (plain Node, hence .mjs) and the pages.

export const REPO = "TautvydasDerzinskas/Thingport";
export const REPO_URL = `https://github.com/${REPO}`;
export const BRANCH = "main";

export const SITE_NAME = "Thingport";
export const TAGLINE = "Your personal 3D model library";
export const SITE_DESCRIPTION =
  "Thingport is a free, open-source, self-hosted library for your 3D printing models. Import from MakerWorld, Printables and Thingiverse, preview STL, 3MF, STEP and OBJ files in your browser, and keep everything organized in one place.";

export const LINKS = {
  github: REPO_URL,
  releases: `${REPO_URL}/releases`,
  issues: `${REPO_URL}/issues`,
  license: `${REPO_URL}/blob/${BRANCH}/LICENSE`,
  sponsors: "https://github.com/sponsors/TautvydasDerzinskas",
  coffee: "https://buymeacoffee.com/TautvydasDerzinskas",
};

/**
 * Pages with a `source` render straight from that repo Markdown file; the rest are Astro pages
 * under src/pages/docs/. `unlisted` pages are built but left out of all navigation.
 */
export const DOCS = [
  {
    slug: "install",
    group: "Getting started",
    title: "Install with Docker Compose",
    nav: "Docker Compose",
    description: "Run Thingport on any Docker host from the pre-built images, with no build step.",
  },
  {
    slug: "providers",
    source: "docs/PROVIDER_SETUP.md",
    group: "Getting started",
    title: "Provider setup",
    nav: "Provider setup",
    description: "Connect MakerWorld and Thingiverse so Thingport can import from them. Printables needs no setup.",
  },
  {
    slug: "guides/existing-library",
    source: "docs/guides/existing-library.md",
    group: "Add your library",
    title: "Bring your existing model library",
    nav: "Bring your library",
    description:
      "Already have folders of STLs, 3MFs and ZIPs? Choose between uploading files, uploading folders and the consume folder.",
  },
  {
    slug: "guides/upload-files",
    source: "docs/guides/upload-files.md",
    group: "Add your library",
    title: "Upload files and ZIPs",
    nav: "Upload files and ZIPs",
    description: "Add models from your computer one by one or many at once, and unpack ZIPs into models and folders.",
  },
  {
    slug: "guides/upload-folders",
    source: "docs/guides/upload-folders.md",
    group: "Add your library",
    title: "Upload a folder",
    nav: "Upload a folder",
    description:
      "Upload a whole folder tree from the browser, with each file or each folder becoming a model and the tree kept.",
  },
  {
    slug: "guides/consume-folder",
    source: "docs/guides/consume-folder.md",
    group: "Add your library",
    title: "Import a library with the consume folder",
    nav: "Consume folder",
    description:
      "Mount a folder on your server and copy your library into it. Thingport imports everything and empties it.",
  },
  {
    slug: "install/unraid",
    source: "docs/install/unraid/README.md",
    group: "Platform guides",
    title: "Install on Unraid",
    nav: "Unraid",
    description: "Run the Thingport stack on Unraid with the built-in Compose support or Compose Manager.",
  },
  {
    slug: "install/truenas",
    source: "docs/install/truenas/README.md",
    group: "Platform guides",
    title: "Install on TrueNAS SCALE",
    nav: "TrueNAS SCALE",
    description: "Run Thingport on TrueNAS SCALE as a Custom App or over SSH, with dataset-backed storage.",
  },
  {
    slug: "install/casaos",
    source: "docs/install/casaos/README.md",
    group: "Platform guides",
    title: "Install on CasaOS",
    nav: "CasaOS",
    description: "Run Thingport on CasaOS as a customized app or over SSH.",
  },
  {
    slug: "grab",
    source: "extension/README.md",
    group: "Companion apps",
    title: "Thingport Grab browser extension",
    nav: "Thingport Grab",
    description: "Import MakerWorld, Printables and Thingiverse models straight from their own pages.",
  },
  {
    slug: "grab/privacy",
    source: "extension/PRIVACY.md",
    group: "Companion apps",
    title: "Thingport Grab privacy policy",
    nav: "Thingport Grab privacy",
    description: "What the Thingport Grab browser extension stores, what it sends, and where.",
    unlisted: true,
  },
  {
    slug: "bridge",
    source: "bridge/README.md",
    group: "Companion apps",
    title: "Thingport Bridge",
    nav: "Thingport Bridge",
    description:
      "A small desktop helper that makes “Open in slicer” work for Bambu Studio, PrusaSlicer, Cura and Anycubic Slicer Next.",
  },
  {
    slug: "guides/api-token",
    source: "docs/guides/api-token.md",
    group: "Integrations",
    title: "Connect other apps with an API token",
    nav: "API token",
    description: "Generate a read-only token that lets other apps, scripts and dashboards read your Thingport library.",
  },
  {
    slug: "contributing",
    source: "CONTRIBUTING.md",
    group: "Contributing",
    title: "Contributing to Thingport",
    nav: "Contributing",
    description: "The branch, commit and pull request workflow for Thingport contributions.",
  },
  {
    slug: "development",
    source: "docs/DEVELOPMENT.md",
    group: "Contributing",
    title: "Development setup",
    nav: "Development",
    description: "Run Thingport locally with hot reload, and run the test suites.",
  },
  {
    slug: "grab/development",
    source: "extension/CONTRIBUTING.md",
    group: "Contributing",
    title: "Developing Thingport Grab",
    nav: "Thingport Grab development",
    description: "Build, run and package the Thingport Grab browser extension for Chrome, Edge and Firefox.",
  },
];

export const NAV_DOCS = DOCS.filter((d) => !d.unlisted);

/** Repo files that have a page on this site, so links between them stay on the site. */
export const SITE_ROUTES_BY_SOURCE = {
  "README.md": "",
  ...Object.fromEntries(DOCS.filter((d) => d.source).map((d) => [d.source, `docs/${d.slug}/`])),
};
