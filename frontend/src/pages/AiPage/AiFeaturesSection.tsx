import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import TuneIcon from "@mui/icons-material/Tune";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { settingsApi, type AiCategorizationSettings } from "../../api/settings";
import type { AiConnection } from "../../api/aiConnections";
import SectionHeader from "../../components/SectionHeader";
import { menuPosition, TileMenuHeader } from "../../components/Layout/ConfigurationDialog/AppTiles";
import AiCategorizationDialog, { type AiCategorizationSection } from "./AiCategorizationDialog";
import CategorizationAnimation from "./CategorizationAnimation";
import { AiLogo } from "./aiLogos";

/** `connections` is null while the models are loading. */
type Props = { connections: AiConnection[] | null; onUnauthorized?: () => void };

const TILE = 112;
const tileShadow = "inset 0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)";

/** What the AIs are used for, each as a tile: click it for its settings, switch it on or off underneath. */
export default function AiFeaturesSection({ connections, onUnauthorized }: Props) {
  const { t } = useTranslation("app");
  const [settings, setSettings] = useState<AiCategorizationSettings | null>(null);
  // The section the dialog is open on, or null when closed.
  const [open, setOpen] = useState<AiCategorizationSection | null>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read again when models come or go: deleting the last one switches the features off on the server.
  const modelCount = connections?.length;
  useEffect(() => {
    if (modelCount === undefined) return;
    let active = true;
    void settingsApi
      .getAiCategorization()
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .catch((err: unknown) => {
        if (err instanceof UnauthorizedError) onUnauthorized?.();
        else if (active) setError(err instanceof Error ? err.message : t("adminSettings.aiCategorization.failed"));
      });
    return () => {
      active = false;
    };
  }, [modelCount, onUnauthorized, t]);

  const toggle = async (enabled: boolean) => {
    setSwitching(true);
    setError(null);
    try {
      setSettings(await settingsApi.updateAiCategorization({ enabled }));
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(err instanceof Error ? err.message : t("adminSettings.aiCategorization.failed"));
    } finally {
      setSwitching(false);
    }
  };

  // The AI it would use: the one it's set to while that exists, otherwise the default, as the backend picks.
  const model =
    connections?.find((connection) => connection.id === settings?.ai_connection_id) ??
    connections?.find((connection) => connection.is_default);
  const hasModel = Boolean(connections?.length);
  // Without a model nothing can run, whatever was saved, and there's nothing to switch on until one is added.
  const enabled = Boolean(settings?.enabled) && hasModel;
  const label = t("adminSettings.aiFeatures.categorization");

  return (
    <Stack spacing={3}>
      <SectionHeader title={t("adminSettings.aiFeatures.heading")} subtitle={t("adminSettings.aiFeatures.subtitle")} />
      {(settings === null || connections === null) && !error ? (
        <CircularProgress size={20} />
      ) : (
        <Box>
          <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, ${TILE + 64}px)`, gap: 2 }}>
            <Stack alignItems="center" spacing={0.75}>
              <Tooltip title={t("adminSettings.aiFeatures.openSettings")} placement="top">
                <ButtonBase
                  onClick={() => setOpen("settings")}
                  onContextMenu={(event) => setMenu(menuPosition(event))}
                  disabled={!settings}
                  aria-label={t("adminSettings.aiFeatures.settingsAria", { feature: label })}
                  sx={{
                    position: "relative",
                    width: TILE,
                    height: TILE,
                    borderRadius: "22px",
                    bgcolor: "#ffffff",
                    boxShadow: tileShadow,
                    filter: enabled ? "none" : "grayscale(1)",
                    opacity: enabled ? 1 : 0.55,
                    transition: "filter 200ms, opacity 200ms, transform 150ms",
                    "&:hover": { transform: "translateY(-1px)" },
                    "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
                  }}
                >
                  <CategorizationAnimation size={84} paused={!enabled} />
                  {model && (
                    // A bubble over the corner, so it reads as which model the feature uses rather than part of it.
                    <Tooltip title={model.model} placement="bottom">
                      <Box
                        sx={{
                          position: "absolute",
                          right: -8,
                          bottom: -8,
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "#ffffff",
                          boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.18)",
                        }}
                      >
                        <AiLogo model={model.model} baseUrl={model.base_url} size={18} />
                      </Box>
                    </Tooltip>
                  )}
                </ButtonBase>
              </Tooltip>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pt: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>
                  {label}
                </Typography>
                {hasModel && (
                  <Switch
                    size="small"
                    checked={enabled}
                    onChange={(event) => void toggle(event.target.checked)}
                    disabled={!settings || switching}
                    slotProps={{
                      input: { "aria-label": t("adminSettings.aiFeatures.toggleAria", { feature: label }) },
                    }}
                  />
                )}
              </Stack>
            </Stack>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            {t("adminSettings.aiFeatures.hint")}
          </Typography>
        </Box>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Menu
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ?? undefined}
        slotProps={{ paper: { sx: { minWidth: 240, maxWidth: 300 } } }}
      >
        <TileMenuHeader
          logo={<AutoAwesomeOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />}
          name={label}
          status={t("adminSettings.aiFeatures.categorizationDescription")}
        />
        <MenuItem
          disabled={!hasModel || !settings || switching}
          onClick={() => {
            setMenu(null);
            void toggle(!enabled);
          }}
        >
          <ListItemIcon>
            <PowerSettingsNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {enabled ? t("adminSettings.aiFeatures.turnOff") : t("adminSettings.aiFeatures.turnOn")}
          </ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!settings}
          onClick={() => {
            setMenu(null);
            setOpen("settings");
          }}
        >
          <ListItemIcon>
            <TuneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("adminSettings.aiCategorization.settings")}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!settings || !enabled}
          onClick={() => {
            setMenu(null);
            setOpen("manage");
          }}
        >
          <ListItemIcon>
            <AutoAwesomeOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("adminSettings.aiCategorization.manage")}</ListItemText>
        </MenuItem>
      </Menu>
      {open && settings && (
        <AiCategorizationDialog
          settings={settings}
          active={enabled}
          connections={connections ?? []}
          initialSection={open}
          onClose={() => setOpen(null)}
          onSaved={setSettings}
          onUnauthorized={onUnauthorized}
        />
      )}
    </Stack>
  );
}
