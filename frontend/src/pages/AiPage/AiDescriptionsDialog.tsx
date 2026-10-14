import { useState } from "react";
import { useTranslation } from "react-i18next";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { aiDescriptionsApi, type AiDescriptionActions, type AiDescriptionSettings } from "../../api/aiDescriptions";
import type { AiConnection } from "../../api/aiConnections";
import HelpTip from "../../components/HelpTip";
import SectionedDialog from "../../components/SectionedDialog";
import AiDescriptionsPanel from "./AiDescriptionsPanel";
import type { FeatureSection } from "./FeatureTile";
import UseAiSelect from "./UseAiSelect";

type Props = {
  settings: AiDescriptionSettings;
  /** Switched on with a model to use; Manage can only be opened then, as nothing can run otherwise. */
  active: boolean;
  initialSection?: FeatureSection;
  connections: AiConnection[];
  onClose: () => void;
  onSaved: (settings: AiDescriptionSettings) => void;
  onUnauthorized?: () => void;
};

type Draft = Omit<AiDescriptionSettings, "enabled">;

// In the order the settings list them.
const ACTIONS: (keyof AiDescriptionActions)[] = [
  "remove_self_promotion",
  "remove_unrelated",
  "translate",
  "generate_missing",
  "fix_spelling",
  "improve_formatting",
];

/** Improved descriptions' settings, and its library run with the rewrites to review. Turning it on and off is the
 *  switch on its tile. */
export default function AiDescriptionsDialog({
  settings,
  active,
  initialSection = "settings",
  connections,
  onClose,
  onSaved,
  onUnauthorized,
}: Props) {
  const { t } = useTranslation("app");
  const [section, setSection] = useState<FeatureSection>(initialSection);
  const [draft, setDraft] = useState<Draft>({
    mode: settings.mode,
    on_import: settings.on_import,
    send_image: settings.send_image,
    ai_connection_id: settings.ai_connection_id,
    actions: settings.actions,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const setAction = (key: keyof AiDescriptionActions, value: boolean) =>
    update("actions", { ...draft.actions, [key]: value });

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      onSaved(await aiDescriptionsApi.updateSettings(draft));
      setSaved(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : t("adminSettings.aiDescriptions.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionedDialog
      open
      onClose={saving ? () => undefined : onClose}
      title={t("adminSettings.aiFeatures.descriptions")}
      sections={[
        { id: "settings" as const, label: t("adminSettings.aiFeatures.settings"), icon: <TuneIcon fontSize="small" /> },
        {
          id: "manage" as const,
          label: t("adminSettings.aiFeatures.manage"),
          icon: <AutoAwesomeOutlinedIcon fontSize="small" />,
          disabled: !active,
        },
      ]}
      section={active ? section : "settings"}
      onSectionChange={setSection}
      size="large"
    >
      {section === "manage" && active ? (
        <AiDescriptionsPanel onUnauthorized={onUnauthorized} onRunStarted={onClose} />
      ) : (
        <Stack spacing={2}>
          {!connections.length && <Alert severity="warning">{t("adminSettings.aiCategorization.noAi")}</Alert>}
          <UseAiSelect
            value={draft.ai_connection_id}
            connections={connections}
            onChange={(id) => update("ai_connection_id", id)}
            disabled={saving}
          />
          <FormControl fullWidth>
            <InputLabel id="ai-descriptions-mode-label">{t("adminSettings.aiCategorization.mode")}</InputLabel>
            <Select
              labelId="ai-descriptions-mode-label"
              label={t("adminSettings.aiCategorization.mode")}
              value={draft.mode}
              onChange={(event) => update("mode", event.target.value as Draft["mode"])}
              disabled={saving}
            >
              <MenuItem value="suggest">{t("adminSettings.aiCategorization.suggest")}</MenuItem>
              <MenuItem value="auto">{t("adminSettings.aiCategorization.auto")}</MenuItem>
            </Select>
          </FormControl>
          {draft.mode === "auto" && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              {t("adminSettings.aiDescriptions.autoHint")}
            </Typography>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={draft.on_import}
                onChange={(event) => update("on_import", event.target.checked)}
                disabled={saving}
              />
            }
            label={t("adminSettings.aiDescriptions.onImport")}
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.send_image}
                onChange={(event) => update("send_image", event.target.checked)}
                disabled={saving}
              />
            }
            label={
              <>
                {t("adminSettings.aiCategorization.sendImage")}
                <HelpTip text={t("adminSettings.aiFeatures.privacy")} />
              </>
            }
          />
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
              {t("adminSettings.aiDescriptions.whatAiDoes")}
            </Typography>
            <FormGroup>
              {ACTIONS.map((key) => {
                // Writing one needs the picture to go by.
                const needsImage = key === "generate_missing" && !draft.send_image;
                return (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        size="small"
                        checked={draft.actions[key] && !needsImage}
                        onChange={(event) => setAction(key, event.target.checked)}
                        disabled={saving || needsImage}
                      />
                    }
                    label={
                      <>
                        {t(`adminSettings.aiDescriptions.actions.${key}`)}
                        {needsImage && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                            {t("adminSettings.aiDescriptions.needsImage")}
                          </Typography>
                        )}
                      </>
                    }
                  />
                );
              })}
            </FormGroup>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              {t("adminSettings.aiCategorization.save")}
            </Button>
          </Stack>
          {saved && <Alert severity="success">{t("adminSettings.aiDescriptions.saved")}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      )}
    </SectionedDialog>
  );
}
