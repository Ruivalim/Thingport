import React from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import HelpTip from "../../components/HelpTip";
import SectionHeader from "../../components/SectionHeader";
import SimplifyIllustration from "./SimplifyIllustration";

type Props = {
  onUnauthorized?: () => void;
};

/** Saves as soon as it's switched. */
export default function SimplifySection({ onUnauthorized }: Props) {
  const { t } = useTranslation("app");
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    settingsApi.getRendering().then(
      (settings) => {
        if (active) setEnabled(settings.simplify_previews);
      },
      (err) => {
        if (!active) return;
        if (err instanceof UnauthorizedError) onUnauthorized?.();
        else setError(t("adminSettings.rendering.simplify.loadFailed"));
      },
    );
    return () => {
      active = false;
    };
  }, [onUnauthorized, t]);

  const toggle = async (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    setSaving(true);
    setError(null);
    try {
      setEnabled((await settingsApi.updateRendering({ simplify_previews: next })).simplify_previews);
    } catch (err) {
      setEnabled(previous);
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : t("adminSettings.rendering.simplify.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const points = (["infoFiles", "infoBenefit", "infoCost", "infoChange"] as const).map((key) =>
    t(`adminSettings.rendering.simplify.${key}`),
  );
  const infoText = [
    t("adminSettings.rendering.simplify.infoTitle"),
    t("adminSettings.rendering.simplify.infoWhat"),
    ...points,
  ].join(" ");
  const info = (
    <>
      <Typography variant="subtitle2" component="div" sx={{ mb: 0.5 }}>
        {t("adminSettings.rendering.simplify.infoTitle")}
      </Typography>
      {t("adminSettings.rendering.simplify.infoWhat")}
      <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </Box>
    </>
  );

  return (
    <Stack spacing={3}>
      <SectionHeader
        title={t("adminSettings.rendering.simplify.heading")}
        subtitle={t("adminSettings.rendering.simplify.subtitle")}
      />
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack spacing={2.5} alignItems="flex-start">
            <SimplifyIllustration />
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={enabled ?? false}
                    disabled={enabled === null || saving}
                    onChange={(e) => void toggle(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {t("adminSettings.rendering.simplify.label")}
                      <HelpTip text={infoText} content={info} />
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        enabled
                          ? "adminSettings.rendering.simplify.helpOn"
                          : "adminSettings.rendering.simplify.helpOff",
                      )}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", m: 0, "& .MuiSwitch-root": { mt: -0.5 } }}
              />
              {saving && <CircularProgress size={16} />}
            </Stack>
          </Stack>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
