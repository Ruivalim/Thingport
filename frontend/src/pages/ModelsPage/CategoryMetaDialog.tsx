import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type { Category, CategoryMetaInput } from "../../api/categories";

type Props = {
  category: Category;
  onClose: () => void;
  onSave: (meta: CategoryMetaInput) => Promise<void>;
};

/** Blank fields clear the metadata. Imports whose site category id matches any listed id
 *  (";"-separated) land in this category. Validation errors show inline and keep the edits. */
export default function CategoryMetaDialog({ category, onClose, onSave }: Props) {
  const { t } = useTranslation(["models", "common"]);
  const untitledLabel = t("models:categories.untitled");
  const [title, setTitle] = useState(category.meta_title ?? "");
  const [description, setDescription] = useState(category.meta_description ?? "");
  const [makerworldCatIds, setMakerworldCatIds] = useState(category.makerworld_cat_ids);
  const [thingiverseCatIds, setThingiverseCatIds] = useState(category.thingiverse_cat_ids);
  const [printablesCatIds, setPrintablesCatIds] = useState(category.printables_cat_ids);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        metaTitle: title.trim() || null,
        metaDescription: description.trim() || null,
        makerworldCatIds,
        thingiverseCatIds,
        printablesCatIds,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("models:errors.updateCategoryMetaFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>
        {t("models:categories.manager.metaDialogTitle", { name: category.name || untitledLabel })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label={t("models:categories.manager.metaTitleLabel")}
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <TextField
            label={t("models:categories.manager.metaDescriptionLabel")}
            fullWidth
            multiline
            minRows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label={t("models:categories.manager.makerworldCatIdLabel")}
              placeholder={t("models:categories.manager.catIdsPlaceholder") ?? undefined}
              helperText={t("models:categories.manager.catIdsHelp")}
              fullWidth
              value={makerworldCatIds}
              onChange={(e) => setMakerworldCatIds(e.target.value)}
              disabled={saving}
            />
            <TextField
              label={t("models:categories.manager.thingiverseCatIdLabel")}
              placeholder={t("models:categories.manager.catIdsPlaceholder") ?? undefined}
              helperText={t("models:categories.manager.catIdsHelp")}
              fullWidth
              value={thingiverseCatIds}
              onChange={(e) => setThingiverseCatIds(e.target.value)}
              disabled={saving}
            />
            <TextField
              label={t("models:categories.manager.printablesCatIdLabel")}
              placeholder={t("models:categories.manager.catIdsPlaceholder") ?? undefined}
              helperText={t("models:categories.manager.catIdsHelp")}
              fullWidth
              value={printablesCatIds}
              onChange={(e) => setPrintablesCatIds(e.target.value)}
              disabled={saving}
            />
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t("common:cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
        >
          {t("common:save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
