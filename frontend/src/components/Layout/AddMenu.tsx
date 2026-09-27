import Box from "@mui/material/Box";
import type { CaptchaAnswer } from "../../api/captcha";
import CaptchaField from "../CaptchaField";
import { useCaptchaSettings } from "../../hooks/useCaptchaSettings";
import React from "react";
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LinkIcon from "@mui/icons-material/Link";
import { useUploadImport } from "../uploads/useUploadImport";
import { useImportJob } from "./ImportJobContext";
import { IMPORT_PROVIDER_INFO } from "../../constants/importProviders";
import {
  detectImportProvider,
  IMPORT_LINK_EXAMPLES,
  isMakerworldCollectionUrl,
  isMakerworldModelUrl,
  type ImportProviderKey,
} from "../../utils/importLinkDetection";
import type { MakerworldProfileScope } from "../../api/imports";

const IMPORT_PROVIDERS: ImportProviderKey[] = ["makerworld", "thingiverse", "printables"];

type Props = {
  categoryId?: string | null;
  makerworldCookie?: string | null;
  onUploaded: () => void;
  onUnauthorized?: () => void;
};

/** The top bar's "+ Add" button -- Upload opens the file picker directly, Import opens a
 *  small paste-a-link dialog. Both share the upload/import plumbing (and the zip / multi-plate
 *  / collection follow-up prompts it can trigger) via useUploadImport. The import dialog shows
 *  every supported provider as a muted chip; whichever one the pasted link resolves to
 *  (detectImportProvider) lights up in that provider's own color. Clicking any chip (matched or
 *  not) toggles a small example-links panel for that provider, since these are the only two link
 *  shapes each site's own model/collection pages take. A MakerWorld *collection* link (as opposed
 *  to a single model) is flagged with a warning and blocks the Import button entirely -- those
 *  can only be bulk-imported via the Thingport Grab browser extension now, not this dialog. */
export default function AddMenu({ categoryId, makerworldCookie, onUploaded, onUnauthorized }: Props) {
  const { t } = useTranslation(["app", "common"]);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");
  const [exampleProvider, setExampleProvider] = React.useState<ImportProviderKey | null>(null);
  // Only offered for a MakerWorld model link; everything else imports its one thing.
  const [profileScope, setProfileScope] = React.useState<MakerworldProfileScope>("url");
  const { isImporting } = useImportJob();
  const upload = useUploadImport({ categoryId, makerworldCookie, onUploaded, onUnauthorized });
  const captchaSettings = useCaptchaSettings();
  const [captcha, setCaptcha] = React.useState<CaptchaAnswer | null>(null);
  const needsCaptcha = Boolean(captchaSettings?.import);

  const detectedProvider = detectImportProvider(linkValue);
  const isBlockedCollection = isMakerworldCollectionUrl(linkValue);
  const isMakerworldModel = isMakerworldModelUrl(linkValue);

  const closeMenu = () => setAnchorEl(null);

  const handleUpload = () => {
    closeMenu();
    upload.triggerUpload();
  };

  const openImport = () => {
    closeMenu();
    setLinkValue("");
    setExampleProvider(null);
    setProfileScope("url");
    setImportOpen(true);
  };

  const closeImport = () => {
    if (upload.importing) return;
    setImportOpen(false);
  };

  const submitImport = async () => {
    if (!linkValue.trim() || isBlockedCollection) return;
    if (needsCaptcha && !captcha?.captcha_answer.trim()) return;
    // The dialog closes either way; reopening it shows a fresh captcha (each one works once).
    await upload.submitImport(linkValue, needsCaptcha ? captcha : null, isMakerworldModel ? profileScope : "url");
    setImportOpen(false);
  };

  return (
    <>
      {upload.fileInput}
      <Tooltip title={isImporting ? t("addMenu.disabledWhileImporting") : ""}>
        <span>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            disabled={upload.isBusy || isImporting}
            onClick={e => setAnchorEl(e.currentTarget)}
          >
            {upload.uploading ? t("uploadBar.uploading") : t("common:add")}
          </Button>
        </span>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        <MenuItem onClick={handleUpload}>
          <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t("common:upload")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={openImport}>
          <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t("common:import")}</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={importOpen} onClose={closeImport} fullWidth maxWidth="sm">
        <DialogTitle>{t("addMenu.importTitle")}</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            {IMPORT_PROVIDERS.map(key => {
              const info = IMPORT_PROVIDER_INFO[key];
              const active = detectedProvider === key;
              return (
                <Chip
                  key={key}
                  label={info.label}
                  size="small"
                  onClick={() => setExampleProvider(prev => (prev === key ? null : key))}
                  sx={{
                    fontWeight: 600,
                    bgcolor: active ? info.color : "action.disabledBackground",
                    color: active ? (info.textColor ?? "#fff") : "text.disabled",
                  }}
                />
              );
            })}
          </Stack>

          {exampleProvider && (
            <Alert severity="info" sx={{ mb: 1.5 }} onClose={() => setExampleProvider(null)}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                {t("addMenu.exampleLinksFor", { provider: IMPORT_PROVIDER_INFO[exampleProvider].label })}
              </Typography>
              <Typography variant="caption" component="div" sx={{ wordBreak: "break-all" }}>
                {t("addMenu.exampleModel")}: {IMPORT_LINK_EXAMPLES[exampleProvider].model}
              </Typography>
              <Typography variant="caption" component="div" sx={{ wordBreak: "break-all" }}>
                {t("addMenu.exampleCollection")}: {IMPORT_LINK_EXAMPLES[exampleProvider].collection}
                {exampleProvider === "makerworld" && ` (${t("addMenu.makerworldCollectionExtensionOnly")})`}
              </Typography>
            </Alert>
          )}

          {isBlockedCollection && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {t("addMenu.makerworldCollectionBlocked")}
            </Alert>
          )}

          <TextField
            fullWidth
            type="url"
            margin="dense"
            value={linkValue}
            onChange={e => setLinkValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitImport();
              }
            }}
            placeholder={t("uploadBar.linkPlaceholder") ?? undefined}
            disabled={upload.importing}
          />
          {isMakerworldModel && (
            <TextField
              select
              fullWidth
              size="small"
              margin="dense"
              label={t("addMenu.profilesLabel")}
              value={profileScope}
              onChange={e => setProfileScope(e.target.value as MakerworldProfileScope)}
              disabled={upload.importing}
              helperText={profileScope === "url" ? t("addMenu.profilesHelpUrl") : t("addMenu.profilesHelpMany")}
              sx={{ mt: 1.5 }}
            >
              <MenuItem value="url">{t("addMenu.profilesUrl")}</MenuItem>
              <MenuItem value="designer">{t("addMenu.profilesDesigner")}</MenuItem>
              <MenuItem value="all">{t("addMenu.profilesAll")}</MenuItem>
            </TextField>
          )}
          {needsCaptcha && (
            <Box sx={{ mt: 2 }}>
              <CaptchaField onChange={setCaptcha} disabled={upload.importing} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImport} disabled={upload.importing}>{t("common:cancel")}</Button>
          <Button
            variant="contained"
            onClick={submitImport}
            disabled={upload.importing || !linkValue.trim() || isBlockedCollection || (needsCaptcha && !captcha?.captcha_answer.trim())}
            startIcon={upload.importing ? <CircularProgress size={14} /> : undefined}
          >
            {upload.importing ? t("uploadBar.importing") : t("common:import")}
          </Button>
        </DialogActions>
      </Dialog>

      {upload.modals}
    </>
  );
}
