import { useMemo } from "react";
import { type Plate, type Print, printsApi } from "../../api/prints";
import { SLICER_OPTIONS } from "../../constants/settingsOptions";
import { useSlicerPreference } from "../../hooks/useSlicerPreference";
import { slicerLaunchUrl } from "../../utils/slicerLaunch";

export type SlicerTarget = { key: string; href: string; filename: string; index: number; plate: Plate | null };

/** `slicerOption` is null without a usable preference. With several targets, the caller offers a
 *  pick rather than opening the first. */
export function useOpenInSlicer(print: Print) {
  const slicerPreference = useSlicerPreference();
  const slicerOption = SLICER_OPTIONS.find((opt) => opt.id === slicerPreference && opt.id !== "other") ?? null;

  const targets = useMemo<SlicerTarget[]>(() => {
    if (!slicerOption || !print.slicer_url) return [];
    const launch = (url: string, filename: string) =>
      slicerLaunchUrl(slicerOption.id, printsApi.fileUrl(url), filename);
    const sortedPlates = print.plates.toSorted((a, b) => a.position - b.position);
    const out: SlicerTarget[] = [];
    const slicerUrlIsPlate = sortedPlates.some((p) => p.url === print.slicer_url);
    if (!slicerUrlIsPlate) {
      const filename = print.slicer_filename ?? "";
      out.push({ key: "prepared", href: launch(print.slicer_url, filename), filename, index: -1, plate: null });
    }
    sortedPlates.forEach((plate, index) => {
      const filename = plate.url === print.slicer_url && print.slicer_filename ? print.slicer_filename : plate.filename;
      out.push({ key: plate.id, href: launch(plate.url, filename), filename: plate.filename, index, plate });
    });
    return out;
  }, [print.plates, print.slicer_url, print.slicer_filename, slicerOption]);

  return { slicerOption, targets };
}
