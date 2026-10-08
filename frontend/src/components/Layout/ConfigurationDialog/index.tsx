import React from "react";
import { useTranslation } from "react-i18next";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import type { ThemeSelection } from "../../../constants/settingsOptions";
import type { MakerWorldSettings } from "../../../utils/settings";
import AppearancePanel from "./AppearancePanel";
import ProvidersPanel from "./ProvidersPanel";
import SlicerPanel from "./SlicerPanel";
import SectionedDialog from "../../SectionedDialog";

export type ConfigurationTab = "appearance" | "providers" | "slicer";

const TABS: { id: ConfigurationTab; icon: React.ReactNode }[] = [
  { id: "appearance", icon: <PaletteOutlinedIcon fontSize="small" /> },
  { id: "providers", icon: <HubOutlinedIcon fontSize="small" /> },
  { id: "slicer", icon: <LayersOutlinedIcon fontSize="small" /> },
];

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

  const sections = TABS.map(({ id, icon }) => ({ id, icon, label: t(`configuration.tabs.${id}`) }));

  return (
    <SectionedDialog
      open={Boolean(open)}
      onClose={onClose}
      title={t("configuration.title")}
      sections={sections}
      section={tab}
      onSectionChange={setTab}
    >
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
    </SectionedDialog>
  );
}
