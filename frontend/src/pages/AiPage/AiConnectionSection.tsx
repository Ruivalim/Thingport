import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { settingsApi, type AiCategorizationSettings } from "../../api/settings";
import SectionHeader from "../../components/SectionHeader";

type Props = { onUnauthorized?: () => void };
type Draft = Pick<AiCategorizationSettings, "concurrency" | "timeout_ms"> & {
  base_url: string;
  model: string;
  api_key: string;
};
const defaults: Draft = { base_url: "", model: "", api_key: "", concurrency: 1, timeout_ms: 60000 };

const pick = (settings: AiCategorizationSettings): Draft => ({
  base_url: settings.base_url ?? "",
  model: settings.model ?? "",
  api_key: "",
  concurrency: settings.concurrency,
  timeout_ms: settings.timeout_ms,
});

export default function AiConnectionSection({ onUnauthorized }: Props) {
  const { t } = useTranslation("app");
  const [draft, setDraft] = useState<Draft>(defaults);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearKey, setClearKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void settingsApi
      .getAiCategorization()
      .then((settings) => {
        if (active) {
          setDraft(pick(settings));
          setHasApiKey(settings.has_api_key);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof UnauthorizedError) onUnauthorized?.();
        else if (active) setError(err instanceof Error ? err.message : t("adminSettings.ai.connection.failed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onUnauthorized, t]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const saved = await settingsApi.updateAiCategorization({
        base_url: draft.base_url.trim() || null,
        model: draft.model.trim() || null,
        concurrency: Number(draft.concurrency),
        timeout_ms: Number(draft.timeout_ms),
        ...(clearKey ? { api_key: null } : draft.api_key ? { api_key: draft.api_key } : {}),
      });
      setDraft(pick(saved));
      setHasApiKey(saved.has_api_key);
      setClearKey(false);
      setStatus(t("adminSettings.ai.connection.saved"));
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : t("adminSettings.ai.connection.failed"));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setStatus(null);
    setError(null);
    try {
      const result = await settingsApi.testAiCategorization({
        base_url: draft.base_url.trim(),
        model: draft.model.trim(),
        timeout_ms: Number(draft.timeout_ms),
        // A blank key field tests with the saved key, unless it is about to be cleared.
        ...(clearKey ? { api_key: null } : draft.api_key ? { api_key: draft.api_key } : {}),
      });
      if (result.ok)
        setStatus(t("adminSettings.ai.connection.testSuccess", { model: result.model, latency: result.latency_ms }));
      else setError(result.error || t("adminSettings.ai.connection.testFailed"));
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : t("adminSettings.ai.connection.testFailed"));
    } finally {
      setTesting(false);
    }
  };

  const canTest = Boolean(draft.base_url.trim() && draft.model.trim());
  const showSavedKey = hasApiKey && !clearKey && !draft.api_key;
  // Saving tests the connection too, so either request locks the whole form.
  const busy = loading || saving || testing;

  return (
    <Stack spacing={3}>
      <SectionHeader
        title={t("adminSettings.ai.connection.heading")}
        subtitle={t("adminSettings.ai.connection.subtitle")}
      />
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <TextField
            label={t("adminSettings.ai.connection.baseUrl")}
            value={draft.base_url}
            onChange={(event) => update("base_url", event.target.value)}
            disabled={busy}
            fullWidth
          />
          <TextField
            label={t("adminSettings.ai.connection.model")}
            value={draft.model}
            onChange={(event) => update("model", event.target.value)}
            disabled={busy}
            fullWidth
          />
          <TextField
            type="password"
            label={t("adminSettings.ai.connection.apiKey")}
            value={draft.api_key}
            onChange={(event) => {
              update("api_key", event.target.value);
              setClearKey(false);
            }}
            helperText={
              clearKey
                ? t("adminSettings.ai.connection.keyWillClear")
                : hasApiKey
                  ? t("adminSettings.ai.connection.keySet")
                  : undefined
            }
            disabled={busy}
            autoComplete="new-password"
            fullWidth
            placeholder={showSavedKey ? "••••••••••••••••" : undefined}
            slotProps={{
              inputLabel: showSavedKey ? { shrink: true } : undefined,
              input: {
                endAdornment:
                  hasApiKey && !clearKey ? (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setClearKey(true);
                          update("api_key", "");
                        }}
                        disabled={busy}
                      >
                        {t("adminSettings.ai.connection.clearKey")}
                      </Button>
                    </InputAdornment>
                  ) : undefined,
              },
            }}
          />
          <TextField
            type="number"
            label={t("adminSettings.ai.connection.concurrency")}
            value={draft.concurrency}
            inputProps={{ min: 1, max: 4, step: 1 }}
            onChange={(event) => update("concurrency", Number(event.target.value))}
            disabled={busy}
          />
          <TextField
            type="number"
            label={t("adminSettings.ai.connection.timeout")}
            value={draft.timeout_ms}
            inputProps={{ min: 1000, step: 1000 }}
            onChange={(event) => update("timeout_ms", Number(event.target.value))}
            disabled={busy}
          />
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={busy}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              {saving ? t("adminSettings.ai.connection.saving") : t("adminSettings.ai.connection.save")}
            </Button>
            {canTest && (
              <Button
                variant="outlined"
                onClick={() => void testConnection()}
                disabled={busy}
                startIcon={testing ? <CircularProgress size={14} color="inherit" /> : undefined}
              >
                {testing ? t("adminSettings.ai.connection.testing") : t("adminSettings.ai.connection.test")}
              </Button>
            )}
            {loading && <CircularProgress size={14} />}
          </Stack>
          {status && <Alert severity="success">{status}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="caption" color="text.secondary">
            {t("adminSettings.ai.connection.writeOnly")}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
