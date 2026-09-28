import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UnauthorizedError } from "../../api/client";
import { type Plate, type Print, printsApi } from "../../api/prints";
import { saveResponseToDisk } from "../../utils/downloadResponse";

/** A single-plate model downloads directly; multi-plate opens a picker. `recordUse` bumps the print
 *  count for Open in {Slicer}. */
export function useDownloadPrint(print: Print, onUnauthorized?: () => void, onRecorded?: (print: Print) => void) {
  const { t } = useTranslation(["models"]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadError = (err: unknown) => {
    if (err instanceof UnauthorizedError) {
      onUnauthorized?.();
      return;
    }
    console.error(err);
    alert(t("models:detail.downloadFailed"));
  };

  // Fire-and-forget. Only a real print is passed on: an older backend answers `{ ok: true }`.
  const recordUse = () => {
    printsApi
      .recordDownload(print.id)
      .then((updated) => {
        if (updated && typeof updated === "object" && updated.id === print.id) onRecorded?.(updated);
      })
      .catch(() => {});
  };

  const downloadPlate = async (plate: Plate) => {
    setDownloading(true);
    try {
      const res = await fetch(printsApi.fileUrl(plate.url));
      if (res.status === 401) throw new UnauthorizedError();
      if (!res.ok) throw new Error("Download failed");
      await saveResponseToDisk(res, plate.filename || "download");
      setPickerOpen(false);
      recordUse();
    } catch (err) {
      handleDownloadError(err);
    } finally {
      setDownloading(false);
    }
  };

  const downloadAllZip = async () => {
    setDownloading(true);
    try {
      const res = await printsApi.downloadZip({ print_ids: [print.id] });
      await saveResponseToDisk(res, `${print.name || "model"}.zip`);
      setPickerOpen(false);
      recordUse();
    } catch (err) {
      handleDownloadError(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = () => {
    if (print.plates.length <= 1) {
      const plate = print.plates[0];
      if (plate) void downloadPlate(plate);
      return;
    }
    setPickerOpen(true);
  };

  const sortedPlates = print.plates.toSorted((a, b) => a.position - b.position);

  return {
    pickerOpen,
    setPickerOpen,
    downloading,
    handleDownload,
    downloadPlate,
    downloadAllZip,
    sortedPlates,
    recordUse,
  };
}
