import React from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import type { ThemeSelection } from "../../../constants/settingsOptions";
import type { MakerWorldSettings } from "../../../utils/settings";
import AppearancePanel from "./AppearancePanel";
import ProvidersPanel from "./ProvidersPanel";
import SlicerPanel from "./SlicerPanel";

export type ConfigurationTab = "appearance" | "providers" | "slicer";

const TABS: { id: ConfigurationTab; icon: React.ReactNode }[] = [
  { id: "appearance", icon: <PaletteOutlinedIcon fontSize="small" /> },
  { id: "providers", icon: <HubOutlinedIcon fontSize="small" /> },
  { id: "slicer", icon: <LayersOutlinedIcon fontSize="small" /> },
];

const selectedBg = (theme: Theme) =>
  theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
const hoverBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)");

type Props = {
  /** The tab to open on, or null when closed. */
  open: ConfigurationTab | null;
  onClose: () => void;
  theme: ThemeSelection;
  onThemeChange: (theme: ThemeSelection) => void;
  isAdmin: boolean;
  makerworldCookie: string;
  onUpdateMakerWorld: (patch: Partial<MakerWorldSettings>) => void;
  onUnauthorized?: () => void;
};

/** Settings by section: the sections on the left, the chosen one on the right. */
export default function ConfigurationDialog({
  open,
  onClose,
  theme,
  onThemeChange,
  isAdmin,
  makerworldCookie,
  onUpdateMakerWorld,
  onUnauthorized,
}: Props) {
  const { t } = useTranslation(["app", "common"]);
  const [tab, setTab] = React.useState<ConfigurationTab>("appearance");

  // Kept while closing, so the panel doesn't switch during the fade.
  React.useEffect(() => {
    if (open) setTab(open);
  }, [open]);

  const tabButton = (id: ConfigurationTab, icon: React.ReactNode, compact: boolean) => {
    const chosen = id === tab;
    return (
      <ButtonBase
        key={id}
        aria-pressed={chosen}
        onClick={() => setTab(id)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: compact ? "center" : "flex-start",
          gap: 1.25,
          flex: compact ? 1 : undefined,
          width: compact ? undefined : "100%",
          px: 1.5,
          py: compact ? 1.25 : 1,
          borderRadius: "8px",
          fontSize: "0.8rem",
          fontWeight: 500,
          color: chosen ? (muiTheme) => muiTheme.thingport.headingText : "text.secondary",
          bgcolor: chosen ? selectedBg : "transparent",
          transition: "background-color 150ms",
          "&:hover": { bgcolor: chosen ? selectedBg : hoverBg },
        }}
      >
        {!compact && icon}
        {t(`configuration.tabs.${id}`)}
      </ButtonBase>
    );
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: 620,
            maxWidth: "calc(100% - 32px)",
            height: { xs: "75vh", md: 520 },
            maxHeight: "calc(100% - 32px)",
            m: 2,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          component="h2"
          sx={{ color: (muiTheme) => muiTheme.thingport.headingText }}
        >
          {t("configuration.title")}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label={t("common:close") ?? undefined}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Phones: the sections as tabs along the top. */}
      <Box
        sx={{
          display: { xs: "flex", md: "none" },
          flexShrink: 0,
          gap: 0.5,
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {TABS.map(({ id, icon }) => tabButton(id, icon, true))}
      </Box>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box
          component="nav"
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            gap: 0.25,
            width: 170,
            flexShrink: 0,
            p: 1.25,
            borderRight: 1,
            borderColor: "divider",
          }}
        >
          {TABS.map(({ id, icon }) => tabButton(id, icon, false))}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", px: { xs: 2, md: 2.5 }, pt: 1.75, pb: 2.5 }}>
          {tab === "appearance" && (
            <AppearancePanel theme={theme} onThemeChange={onThemeChange} onUnauthorized={onUnauthorized} />
          )}
          {tab === "providers" && (
            <ProvidersPanel
              isAdmin={isAdmin}
              cookie={makerworldCookie}
              onUpdateMakerWorld={onUpdateMakerWorld}
              onUnauthorized={onUnauthorized}
            />
          )}
          {tab === "slicer" && <SlicerPanel onNavigate={onClose} onUnauthorized={onUnauthorized} />}
        </Box>
      </Box>
    </Dialog>
  );
}
