// esbuild loaders (see scripts/build.ts): an .svg import is its markup as a string (inlined, so
// nothing has to be web-accessible or pass the host page's image CSP), and a .scss import with
// `?inline` is the compiled CSS as a string (for the content script's shadow root).
declare module "*.svg" {
  const markup: string;
  export default markup;
}
declare module "*.scss?inline" {
  const css: string;
  export default css;
}
declare module "*.scss";
