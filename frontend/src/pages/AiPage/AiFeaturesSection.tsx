import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { aiDescriptionsApi } from "../../api/aiDescriptions";
import type { AiConnection } from "../../api/aiConnections";
import SectionHeader from "../../components/SectionHeader";
import { useAiDescriptionRun, useAiRun } from "../../components/Layout/AiRunContext";
import AiCategorizationDialog from "./AiCategorizationDialog";
import AiDescriptionsDialog from "./AiDescriptionsDialog";
import CategorizationAnimation from "./CategorizationAnimation";
import DescriptionAnimation from "./DescriptionAnimation";
import FeatureTile, { FEATURE_TILE, type FeatureSection } from "./FeatureTile";

/** `connections` is null while the models are loading. */
type Props = { connections: AiConnection[] | null; onUnauthorized?: () => void };

type FeatureSettings = { enabled: boolean; ai_connection_id: string | null };

/**
 * One feature's settings: loaded, switched on and off, and read again when models come or go (deleting the last
 * one switches every feature off on the server).
 */
function useFeature<T extends FeatureSettings>(
  load: () => Promise<T>,
  update: (input: { enabled: boolean }) => Promise<T>,
  modelCount: number | undefined,
  onUnauthorized: (() => void) | undefined,
  failed: string,
) {
  const [settings, setSettings] = useState<T | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : failed);
    },
    [onUnauthorized, failed],
  );

  useEffect(() => {
    if (modelCount === undefined) return;
    let active = true;
    void load()
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .catch((err: unknown) => {
        if (active) fail(err);
      });
    return () => {
      active = false;
    };
  }, [load, modelCount, fail]);

  const toggle = async (enabled: boolean) => {
    setSwitching(true);
    setError(null);
    try {
      setSettings(await update({ enabled }));
    } catch (err) {
      fail(err);
    } finally {
      setSwitching(false);
    }
  };
  return { settings, setSettings, switching, error, setError, toggle };
}

/** What the AIs are used for, each as a tile: click it for its settings, switch it on or off underneath. */
export default function AiFeaturesSection({ connections, onUnauthorized }: Props) {
  const { t } = useTranslation("app");
  const modelCount = connections?.length;
  const { running: categorizing } = useAiRun();
  const { running: improving } = useAiDescriptionRun();
  const categorization = useFeature(
    settingsApi.getAiCategorization,
    settingsApi.updateAiCategorization,
    modelCount,
    onUnauthorized,
    t("adminSettings.aiCategorization.failed"),
  );
  const descriptions = useFeature(
    aiDescriptionsApi.getSettings,
    aiDescriptionsApi.updateSettings,
    modelCount,
    onUnauthorized,
    t("adminSettings.aiDescriptions.failed"),
  );
  // Which dialog is open, and on which section.
  const [open, setOpen] = useState<{ feature: "categorization" | "descriptions"; section: FeatureSection } | null>(
    null,
  );

  const hasModel = Boolean(connections?.length);
  // The AI a feature would use: the one it's set to while that exists, otherwise the default, as the backend picks.
  const modelFor = (settings: FeatureSettings | null) =>
    connections?.find((connection) => connection.id === settings?.ai_connection_id) ??
    connections?.find((connection) => connection.is_default);
  // Without a model nothing can run, whatever was saved, and there's nothing to switch on until one is added.
  const categorizationOn = Boolean(categorization.settings?.enabled) && hasModel;
  const descriptionsOn = Boolean(descriptions.settings?.enabled) && hasModel;
  const loading = connections === null || (!categorization.settings && !categorization.error);
  const errors = [
    { key: "categorization", ...categorization },
    { key: "descriptions", ...descriptions },
  ].filter((feature) => feature.error);

  return (
    <Stack spacing={3}>
      <SectionHeader title={t("adminSettings.aiFeatures.heading")} subtitle={t("adminSettings.aiFeatures.subtitle")} />
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Box>
          <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, ${FEATURE_TILE + 104}px)`, gap: 2 }}>
            <FeatureTile
              label={t("adminSettings.aiFeatures.categorization")}
              description={t("adminSettings.aiFeatures.categorizationDescription")}
              Animation={CategorizationAnimation}
              enabled={categorizationOn}
              hasModel={hasModel}
              model={modelFor(categorization.settings)}
              ready={Boolean(categorization.settings)}
              switching={categorization.switching}
              running={categorizing}
              onToggle={(enabled) => void categorization.toggle(enabled)}
              onOpen={(section) => setOpen({ feature: "categorization", section })}
            />
            <FeatureTile
              label={t("adminSettings.aiFeatures.descriptions")}
              description={t("adminSettings.aiFeatures.descriptionsDescription")}
              Animation={DescriptionAnimation}
              enabled={descriptionsOn}
              hasModel={hasModel}
              model={modelFor(descriptions.settings)}
              ready={Boolean(descriptions.settings)}
              switching={descriptions.switching}
              running={improving}
              onToggle={(enabled) => void descriptions.toggle(enabled)}
              onOpen={(section) => setOpen({ feature: "descriptions", section })}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            {t("adminSettings.aiFeatures.hint")}
          </Typography>
        </Box>
      )}
      {errors.map((feature) => (
        <Alert key={feature.key} severity="error" onClose={() => feature.setError(null)}>
          {feature.error}
        </Alert>
      ))}
      {open?.feature === "categorization" && categorization.settings && (
        <AiCategorizationDialog
          settings={categorization.settings}
          active={categorizationOn}
          connections={connections ?? []}
          initialSection={open.section}
          onClose={() => setOpen(null)}
          onSaved={categorization.setSettings}
          onUnauthorized={onUnauthorized}
        />
      )}
      {open?.feature === "descriptions" && descriptions.settings && (
        <AiDescriptionsDialog
          settings={descriptions.settings}
          active={descriptionsOn}
          connections={connections ?? []}
          initialSection={open.section}
          onClose={() => setOpen(null)}
          onSaved={descriptions.setSettings}
          onUnauthorized={onUnauthorized}
        />
      )}
    </Stack>
  );
}
