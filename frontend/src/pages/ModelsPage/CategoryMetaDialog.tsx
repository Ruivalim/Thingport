import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type { Category, CategoryMetaInput } from "../../api/categories";
import HelpTip from "../../components/HelpTip";
import { SectionLabel } from "../../components/Layout/ConfigurationDialog/parts";
import ProviderCategoryMappings, {
  type MappedProvider,
} from "../../components/categoryMapping/ProviderCategoryMappings";

type Props = {
  category: Category;
  /** Folders hold the user's own tree, so imports aren't sorted into them by site category id. */
  showSiteCatIds: boolean;
  onClose: () => void;
  onSave: (meta: CategoryMetaInput) => Promise<void>;
};

/** Blank fields clear the metadata. Imports whose site category matches one picked for its provider land in this
 *  category. Validation errors show inline and keep the edits. */
export default function CategoryMetaDialog({ category, showSiteCatIds, onClose, onSave }: Props) {
  const { t } = useTranslation(["models", "common"]);
  const untitledLabel = t("models:categories.untitled");
  const [title, setTitle] = useState(category.meta_title ?? "");
  const [description, setDescription] = useState(category.meta_description ?? "");
  const [catIds, setCatIds] = useState<Record<MappedProvider, string>>({
    makerworld: category.makerworld_cat_ids,
    thingiverse: category.thingiverse_cat_ids,
    printables: category.printables_cat_ids,
    myminifactory: category.myminifactory_cat_ids,
    snapmaker: category.snapmaker_cat_ids,
    makeronline: category.makeronline_cat_ids,
    crealitycloud: category.crealitycloud_cat_ids,
    nexprint: category.nexprint_cat_ids,
    thangs: category.thangs_cat_ids,
    cults3d: category.cults3d_cat_ids,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        metaTitle: title.trim() || null,
        metaDescription: description.trim() || null,
        makerworldCatIds: catIds.makerworld,
        thingiverseCatIds: catIds.thingiverse,
        printablesCatIds: catIds.printables,
        myminifactoryCatIds: catIds.myminifactory,
        snapmakerCatIds: catIds.snapmaker,
        makeronlineCatIds: catIds.makeronline,
        crealitycloudCatIds: catIds.crealitycloud,
        nexprintCatIds: catIds.nexprint,
        thangsCatIds: catIds.thangs,
        cults3dCatIds: catIds.cults3d,
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
          {showSiteCatIds && (
            <Box>
              <SectionLabel>
                {t("models:categories.manager.mapping.heading")}
                <HelpTip
                  text={t("models:categories.manager.mapping.help", { category: category.name || untitledLabel })}
                />
              </SectionLabel>
              <ProviderCategoryMappings
                value={catIds}
                onChange={(provider, value) => setCatIds((current) => ({ ...current, [provider]: value }))}
                categoryName={category.name || untitledLabel}
                disabled={saving}
              />
            </Box>
          )}
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
