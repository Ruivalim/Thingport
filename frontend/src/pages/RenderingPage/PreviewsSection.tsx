import React from "react";
import { useTranslation } from "react-i18next";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { UnauthorizedError } from "../../api/client";
import { settingsApi, type PreviewMode } from "../../api/settings";
import Segmented from "../../components/controls/Segmented";
import HelpTip from "../../components/HelpTip";
import PreviewModeIllustration from "./PreviewModeIllustration";
import SectionHeader from "../../components/SectionHeader";

type Props = {
  onUnauthorized?: () => void;
  onSaved?: (mode: PreviewMode) => void;
};

export default function PreviewsSection({ onUnauthorized, onSaved }: Props) {
  const { t } = useTranslation("app");
  const [mode, setMode] = React.useState<PreviewMode>("automatic");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const data = await settingsApi.getPreviews();
        if (active) setMode(data.mode);
      } catch (err) {
        if (err instanceof UnauthorizedError) onUnauthorized?.();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [onUnauthorized]);

  const selectMode = async (next: PreviewMode) => {
    if (next === mode || saving) return;
    const previous = mode;
    setMode(next);
    setSaving(true);
    setStatus(null);
    try {
      const data = await settingsApi.updatePreviews(next);
      onSaved?.(data.mode);
    } catch (err) {
      setMode(previous);
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
      } else {
        setStatus(err instanceof Error ? err.message : t("adminSettings.previews.failed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const options: Array<{ id: PreviewMode; label: string; description: string }> = [
    {
      id: "automatic",
      label: t("adminSettings.previews.automaticLabel"),
      description: t("adminSettings.previews.automaticDesc"),
    },
    {
      id: "on-demand",
      label: t("adminSettings.previews.onDemandLabel"),
      description: t("adminSettings.previews.onDemandDesc"),
    },
    {
      id: "disabled",
      label: t("adminSettings.previews.disabledLabel"),
      description: t("adminSettings.previews.disabledDesc"),
    },
  ];

  const points = (["infoAutomatic", "infoOnDemand", "infoDisabled"] as const).map((key) =>
    t(`adminSettings.previews.${key}`),
  );
  const infoText = [t("adminSettings.previews.infoTitle"), t("adminSettings.previews.infoScope"), ...points].join(" ");
  const info = (
    <>
      <Typography variant="subtitle2" component="div" sx={{ mb: 0.5 }}>
        {t("adminSettings.previews.infoTitle")}
      </Typography>
      {t("adminSettings.previews.infoScope")}
      <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </Box>
    </>
  );

  return (
    <Stack spacing={3}>
      <SectionHeader title={t("adminSettings.previews.heading")} subtitle={t("adminSettings.previews.subtitle")} />
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <PreviewModeIllustration
            value={mode}
            onChange={(next) => void selectMode(next)}
            disabled={loading || saving}
            options={options.map((option) => ({ value: option.id, label: option.label }))}
          />
          <Stack spacing={0.75} alignItems="flex-start">
            <Typography variant="body2" fontWeight={600}>
              {t("adminSettings.previews.modeLabel")}
              <HelpTip text={infoText} content={info} />
            </Typography>
            <Segmented
              label={t("adminSettings.previews.heading")}
              value={mode}
              onChange={(next) => void selectMode(next)}
              disabled={loading || saving}
              options={options.map((option) => ({ value: option.id, label: option.label }))}
            />
            <Typography variant="caption" color="text.secondary">
              {options.find((option) => option.id === mode)?.description}
            </Typography>
          </Stack>
          {(saving || status) && (
            <Stack direction="row" alignItems="center" spacing={1}>
              {saving && <CircularProgress size={14} />}
              {status && (
                <Typography variant="caption" color="text.secondary">
                  {status}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
