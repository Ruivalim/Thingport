import { useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import TuneIcon from "@mui/icons-material/Tune";
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
import SectionedDialog from "../../components/SectionedDialog";
import AiCategorizationPanel from "../ModelsPage/AiCategorizationPanel";
import { AiLogo, hostOf } from "./aiLogos";

type Section = "settings" | "manage";

/** An option in the "Use AI" list: the model's logo and what to call it. */
function AiOption({ connection, label }: { connection: AiConnection | undefined; label: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      {connection ? (
        <AiLogo model={connection.model} baseUrl={connection.base_url} size={18} />
      ) : (
        <span style={{ width: 18 }} />
      )}
      <span>{label}</span>
    </Stack>
  );
}

type Props = {
  settings: AiCategorizationSettings;
  /** Switched on with a model to use; Manage can only be opened then, as nothing can run otherwise. */
  active: boolean;
  connections: AiConnection[];
  onClose: () => void;
  onSaved: (settings: AiCategorizationSettings) => void;
  onUnauthorized?: () => void;
};

type Draft = Pick<AiCategorizationSettings, "mode" | "threshold" | "on_import" | "send_image" | "ai_connection_id">;

/** AI categorization's settings, and the library run with its suggestions, as in the categories manager. Turning
 *  it on and off is the switch on its tile. */
export default function AiCategorizationDialog({
  settings,
  active,
  connections,
  onClose,
  onSaved,
  onUnauthorized,
}: Props) {
  const { t } = useTranslation("app");
  const [section, setSection] = useState<Section>("settings");
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    mode: settings.mode,
    threshold: settings.threshold,
    on_import: settings.on_import,
    send_image: settings.send_image,
    ai_connection_id: settings.ai_connection_id,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      onSaved(await settingsApi.updateAiCategorization({ ...draft, threshold: Number(draft.threshold) }));
      setSaved(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : t("adminSettings.aiCategorization.failed"));
    } finally {
      setSaving(false);
    }
  };

  const defaultConnection = connections.find((connection) => connection.is_default);
  const defaultOption = (
    <AiOption
      connection={defaultConnection}
      label={t("adminSettings.aiCategorization.defaultAi", { model: defaultConnection?.model ?? "—" })}
    />
  );

  return (
    <SectionedDialog
      open
      onClose={saving ? () => undefined : onClose}
      title={t("adminSettings.aiCategorization.heading")}
      sections={[
        {
          id: "settings" as const,
          label: t("adminSettings.aiCategorization.settings"),
          icon: <TuneIcon fontSize="small" />,
        },
        {
          id: "manage" as const,
          label: t("adminSettings.aiCategorization.manage"),
          icon: <AutoAwesomeOutlinedIcon fontSize="small" />,
          disabled: !active,
        },
      ]}
      section={active ? section : "settings"}
      onSectionChange={setSection}
      size="large"
    >
      {section === "manage" && active ? (
        <AiCategorizationPanel onUnauthorized={onUnauthorized} onRunStarted={onClose} />
      ) : (
        <Stack spacing={2}>
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
              // The chosen option as it looks in the list, logo included; empty is the default AI.
              renderValue={(value) => {
                const chosen = connections.find((connection) => connection.id === value);
                return chosen ? (
                  <AiOption connection={chosen} label={`${chosen.model} · ${hostOf(chosen.base_url)}`} />
                ) : (
                  defaultOption
                );
              }}
              onChange={(event) => update("ai_connection_id", event.target.value || null)}
              disabled={saving || !connections.length}
            >
              <MenuItem value="">{defaultOption}</MenuItem>
              {connections.map((connection) => (
                <MenuItem key={connection.id} value={connection.id}>
                  <AiOption connection={connection} label={`${connection.model} · ${hostOf(connection.base_url)}`} />
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
          {saved && <Alert severity="success">{t("adminSettings.aiCategorization.saved")}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      )}
    </SectionedDialog>
  );
}
