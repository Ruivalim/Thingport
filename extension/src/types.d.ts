// esbuild loaders (see scripts/build.ts): .svg imports are markup strings, `?inline` .scss imports
// are compiled CSS strings.
declare module "*.svg" {
  const markup: string;
  export default markup;
}
declare module "*.scss?inline" {
  const css: string;
  export default css;
}
declare module "*.scss";
