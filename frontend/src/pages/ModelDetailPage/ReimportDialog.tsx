import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { printsApi, type Print, type ReimportResult } from "../../api/prints";
import { importProviderInfo } from "../../constants/importProviders";
import { useToast } from "../../components/ToastProvider";

type Props = {
  open: boolean;
  print: Print;
  onClose: () => void;
  onUpdated: (print: Print) => void;
  onUnauthorized?: () => void;
};

/** "Update from source": pulls what the source offers now. Only empty fields are filled, so a
 *  title, note or creator the user typed always wins, and tags are only ever added. */
export default function ReimportDialog({ open, print, onClose, onUpdated, onUnauthorized }: Props) {
  const { t } = useTranslation(["models", "common"]);
  const showToast = useToast();
  const [metadata, setMetadata] = useState(true);
  const [files, setFiles] = useState(true);
  const [images, setImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const providerLabel = importProviderInfo(print.source_provider)?.label ?? t("models:detail.reimportSource");

  const summaryOf = (result: ReimportResult): string => {
    const filesAdded = result.files_added;
    const imagesAdded = result.images_added;
    const tagsAdded = result.tags_added.length;
    if (
      !filesAdded &&
      !imagesAdded &&
      !tagsAdded &&
      !result.title_filled &&
      !result.notes_filled &&
      !result.creator_filled &&
      !result.author_linked &&
      !result.category_filled
    ) {
      return t("models:detail.reimportNothing");
    }
    return t("models:detail.reimportDone", { filesAdded, imagesAdded, tagsAdded });
  };

  const submit = async () => {
    setBusy(true);
    try {
      const result = await printsApi.reimport(print.id, { metadata, files, images });
      const updated = await printsApi.get(print.id);
      onUpdated(updated);
      showToast({ message: summaryOf(result) });
      onClose();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
        return;
      }
      showToast({ message: err instanceof Error ? err.message : t("models:detail.reimportFailed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("models:detail.reimportTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("models:detail.reimportHint", { provider: providerLabel })}
        </Typography>
        <Stack>
          <FormControlLabel
            control={<Checkbox checked={metadata} onChange={(e) => setMetadata(e.target.checked)} disabled={busy} />}
            label={t("models:detail.reimportMetadata")}
          />
          <FormControlLabel
            control={<Checkbox checked={files} onChange={(e) => setFiles(e.target.checked)} disabled={busy} />}
            label={t("models:detail.reimportFiles")}
          />
          <FormControlLabel
            control={<Checkbox checked={images} onChange={(e) => setImages(e.target.checked)} disabled={busy} />}
            label={t("models:detail.reimportImages")}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t("common:cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={busy || (!metadata && !files && !images)}
          startIcon={busy ? <CircularProgress size={14} /> : undefined}
        >
          {t("models:detail.reimportSubmit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
