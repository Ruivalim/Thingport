import React from "react";
import { useTranslation } from "react-i18next";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { settingsApi } from "../../api/settings";

/** The providers whose access is one key for the whole instance. */
export type KeyedProvider = "thingiverse" | "myminifactory";

const KEY_API: Record<
  KeyedProvider,
  { get: () => Promise<{ configured: boolean }>; update: (key: string | null) => Promise<{ configured: boolean }> }
> = {
  thingiverse: { get: settingsApi.getThingiverse, update: settingsApi.updateThingiverse },
  myminifactory: { get: settingsApi.getMyminifactory, update: settingsApi.updateMyminifactory },
};

type Props = {
  provider: KeyedProvider;
  onUnauthorized?: () => void;
  /** Whether a key is set, whenever that's learned or changes. */
  onConfiguredChange?: (configured: boolean) => void;
};

/** A provider's instance key form (Thingiverse's App Token, MyMiniFactory's API key), in the Providers page's dialog.
 *  Write-only: the server only reports whether a key is set. */
export default function ProviderKeySection({ provider, onUnauthorized, onConfiguredChange }: Props) {
  const { t } = useTranslation("app");
  const api = KEY_API[provider];
  const k = (key: string) => t(`adminSettings.${provider}.${key}`);
  const [configured, setConfigured] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const data = await api.get();
        if (active) setConfigured(data.configured);
      } catch (err) {
        if (err instanceof UnauthorizedError) onUnauthorized?.();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api, onUnauthorized]);

  React.useEffect(() => {
    if (!loading) onConfiguredChange?.(configured);
  }, [configured, loading, onConfiguredChange]);

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const data = await api.update(trimmed);
      setConfigured(data.configured);
      setDraft("");
      setStatus(k("saved"));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
      } else {
        setError(err instanceof Error ? err.message : k("failed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const data = await api.update(null);
      setConfigured(data.configured);
      setDraft("");
      setStatus(k("cleared"));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
      } else {
        setError(err instanceof Error ? err.message : k("failed"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary">
        {k("helpText")}
      </Typography>

      <Alert severity={configured ? "success" : "warning"}>
        {configured ? k("statusConfigured") : k("statusNotConfigured")}
      </Alert>

      <TextField
        label={k("tokenLabel")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={k("tokenPlaceholder") ?? undefined}
        helperText={configured ? k("tokenHelperConfigured") : undefined}
        disabled={loading || saving}
        fullWidth
        autoComplete="off"
      />

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="contained" onClick={save} disabled={loading || saving || !draft.trim()}>
          {saving ? k("saving") : k("save")}
        </Button>
        {configured && (
          <Button variant="outlined" color="error" onClick={clear} disabled={loading || saving}>
            {k("clear")}
          </Button>
        )}
        {saving && <CircularProgress size={14} />}
      </Stack>

      {status && <Alert severity="success">{status}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
