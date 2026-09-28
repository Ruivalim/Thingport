import type { TFunction } from "i18next";
import { extOf, stemOf } from "../../utils/fileExtensions";

/** e.g. "Body" / "File 2 · STL". */
export function fileRowText(t: TFunction, filename: string, index: number): { primary: string; secondary: string } {
  const type = extOf(filename).toUpperCase();
  return {
    primary: stemOf(filename),
    secondary: type ? t("models:detail.fileMeta", { n: index + 1, type }) : t("models:detail.fileLabel", { n: index + 1 }),
  };
}
