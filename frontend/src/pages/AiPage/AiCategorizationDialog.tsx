import { useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { UnauthorizedError } from "../../api/client";
import { settingsApi, type AiCategorizationSettings } from "../../api/settings";
import type { AiConnection } from "../../api/aiConnections";
import { hostOf } from "./aiLogos";

type Props = {
  settings: AiCategorizationSettings;
  connections: AiConnection[];
  onClose: () => void;
  onSaved: (settings: AiCategorizationSettings) => void;
  onUnauthorized?: () => void;
};

type Draft = Pick<AiCategorizationSettings, "mode" | "threshold" | "on_import" | "send_image" | "ai_connection_id">;

/** How AI categorization behaves. Turning it on and off is the switch on its tile. */
export default function AiCategorizationDialog({ settings, connections, onClose, onSaved, onUnauthorized }: Props) {
  const { t } = useTranslation(["app", "common"]);
  const [draft, setDraft] = useState<Draft>({
    mode: settings.mode,
    threshold: settings.threshold,
    on_import: settings.on_import,
    send_image: settings.send_image,
    ai_connection_id: settings.ai_connection_id,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await settingsApi.updateAiCategorization({ ...draft, threshold: Number(draft.threshold) }));
      onClose();
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : t("adminSettings.aiCategorization.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("adminSettings.aiCategorization.heading")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">{t("adminSettings.aiCategorization.privacy")}</Alert>
          {!connections.length && <Alert severity="warning">{t("adminSettings.aiCategorization.noAi")}</Alert>}
          <FormControl fullWidth>
            {/* Empty means the default AI, which still shows text, so the label stays up on the border. */}
            <InputLabel id="ai-connection-label" shrink>
              {t("adminSettings.aiCategorization.useAi")}
            </InputLabel>
            <Select
              labelId="ai-connection-label"
              label={t("adminSettings.aiCategorization.useAi")}
              // A saved choice that's gone (deleted meanwhile) reads as the default, as the backend treats it.
              value={
                draft.ai_connection_id && connections.some((connection) => connection.id === draft.ai_connection_id)
                  ? draft.ai_connection_id
                  : ""
              }
              displayEmpty
              notched
              onChange={(event) => update("ai_connection_id", event.target.value || null)}
              disabled={saving || !connections.length}
            >
              <MenuItem value="">
                {t("adminSettings.aiCategorization.defaultAi", {
                  model: connections.find((connection) => connection.is_default)?.model ?? "—",
                })}
              </MenuItem>
              {connections.map((connection) => (
                <MenuItem key={connection.id} value={connection.id}>
                  {connection.model} · {hostOf(connection.base_url)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="ai-mode-label">{t("adminSettings.aiCategorization.mode")}</InputLabel>
            <Select
              labelId="ai-mode-label"
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
            <TextField
              type="number"
              label={t("adminSettings.aiCategorization.threshold")}
              value={draft.threshold}
              inputProps={{ min: 0, max: 1, step: 0.05 }}
              onChange={(event) => update("threshold", Number(event.target.value))}
              disabled={saving}
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={draft.on_import}
                onChange={(event) => update("on_import", event.target.checked)}
                disabled={saving}
              />
            }
            label={t("adminSettings.aiCategorization.onImport")}
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.send_image}
                onChange={(event) => update("send_image", event.target.checked)}
                disabled={saving}
              />
            }
            label={t("adminSettings.aiCategorization.sendImage")}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          {t("common:cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => void save()}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {t("adminSettings.aiCategorization.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
