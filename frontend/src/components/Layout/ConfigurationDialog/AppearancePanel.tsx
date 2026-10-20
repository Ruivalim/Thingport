import React from "react";
import { useTranslation } from "react-i18next";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../../api/client";
import { settingsApi } from "../../../api/settings";
import { matchLanguage, SUPPORTED_LANGUAGES } from "../../../constants/languages";
import type { ThemeSelection } from "../../../constants/settingsOptions";
import { setCachedAuthorPreviewEnabled, useAuthorPreviewEnabled } from "../../../hooks/useAuthorPreviewEnabled";
import Segmented from "../../controls/Segmented";
import HelpTip from "../../HelpTip";
import { PanelHeader, SectionLabel } from "./parts";

const THEMES: ThemeSelection[] = ["light", "dark", "system"];
// More languages than this no longer fit a segmented control comfortably.
const MAX_SEGMENTED_LANGUAGES = 4;

type Props = {
  theme: ThemeSelection;
  onThemeChange: (theme: ThemeSelection) => void;
  onUnauthorized?: () => void;
};

/** Theme, language and author preview, each applied as it's changed. */
export default function AppearancePanel({ theme, onThemeChange, onUnauthorized }: Props) {
  const { t, i18n } = useTranslation("app");
  const authorPreview = useAuthorPreviewEnabled();
  const [authorPreviewError, setAuthorPreviewError] = React.useState<string | null>(null);
  const language = matchLanguage(i18n.resolvedLanguage ?? i18n.language);

  const toggleAuthorPreview = async (enabled: boolean) => {
    setAuthorPreviewError(null);
    // Shown straight away; put back if the save fails.
    setCachedAuthorPreviewEnabled(enabled);
    try {
      const res = await settingsApi.updateAuthorPreview(enabled);
      setCachedAuthorPreviewEnabled(res.enabled);
    } catch (err) {
      setCachedAuthorPreviewEnabled(!enabled);
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setAuthorPreviewError(t("profile.authorPreview.failed"));
    }
  };

  return (
    <>
      <PanelHeader title={t("appearance.title")} subtitle={t("appearance.subtitle")} />
      <Stack spacing={2.5}>
        <div>
          <SectionLabel>{t("userMenu.theme")}</SectionLabel>
          <Segmented
            label={t("userMenu.theme")}
            value={theme}
            onChange={onThemeChange}
            options={THEMES.map((value) => ({ value, label: t(`appearance.themes.${value}`) }))}
          />
        </div>
        <div>
          <SectionLabel>{t("profile.language.heading")}</SectionLabel>
          {SUPPORTED_LANGUAGES.length > MAX_SEGMENTED_LANGUAGES ? (
            <Select
              size="small"
              value={language}
              onChange={(e) => void i18n.changeLanguage(e.target.value)}
              inputProps={{ "aria-label": t("profile.language.heading") }}
              sx={{ minWidth: 200 }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code} lang={lang.code}>
                  {lang.label}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Segmented
              label={t("profile.language.heading")}
              value={language}
              onChange={(code) => void i18n.changeLanguage(code)}
              options={SUPPORTED_LANGUAGES.map((lang) => ({ value: lang.code, label: lang.label }))}
            />
          )}
        </div>
        <div>
          <SectionLabel>
            {t("profile.authorPreview.heading")}
            <HelpTip text={t("profile.authorPreview.help")} />
          </SectionLabel>
          <Segmented
            label={t("profile.authorPreview.heading")}
            value={authorPreview ? "on" : "off"}
            onChange={(value) => void toggleAuthorPreview(value === "on")}
            options={[
              { value: "on", label: t("appearance.on") },
              { value: "off", label: t("appearance.off") },
            ]}
          />
          {authorPreviewError && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
              {authorPreviewError}
            </Typography>
          )}
        </div>
      </Stack>
    </>
  );
}
