import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import CheckIcon from "@mui/icons-material/Check";
import type { CollectionSync } from "../api/collections";
import { importProviderInfo } from "../constants/importProviders";
import { ProviderLogo, type ProviderId } from "./Layout/ConfigurationDialog/providerLogos";

const LOGO_PROVIDERS = new Set<string>(["makerworld", "thingiverse", "printables"]);

type Props = {
  sync: CollectionSync;
  size?: number;
  /** Makes the badge a button, e.g. to open the collection's sync configuration. */
  onClick?: () => void;
};

/** The provider's logo with a green "connected" bubble. */
export default function CollectionSyncBadge({ sync, size = 30, onClick }: Props) {
  const { t } = useTranslation("models");
  const provider = importProviderInfo(sync.provider)?.label ?? sync.provider;
  const label = sync.likes_of
    ? t("collections.sync.badgeLikes", { user: sync.likes_of })
    : t("collections.sync.badge", { provider });
  const bubble = Math.round(size * 0.5);
  const frame = {
    position: "relative",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: size,
    height: size,
    borderRadius: "8px",
    border: "1px solid",
    borderColor: "divider",
    bgcolor: "background.paper",
  } as const;
  const content = (
    <>
      {LOGO_PROVIDERS.has(sync.provider) && (
        <ProviderLogo id={sync.provider as ProviderId} size={Math.round(size * 0.55)} />
      )}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          right: -Math.round(bubble / 3),
          bottom: -Math.round(bubble / 3),
          display: "grid",
          placeItems: "center",
          width: bubble,
          height: bubble,
          borderRadius: "50%",
          bgcolor: "primary.main",
          color: "#fff",
          boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`,
        }}
      >
        <CheckIcon sx={{ fontSize: Math.round(bubble * 0.75) }} />
      </Box>
    </>
  );

  if (!onClick) {
    return (
      // Decorative here: whatever shows it also says what it's synced with.
      <Box aria-hidden sx={frame}>
        {content}
      </Box>
    );
  }
  return (
    <Tooltip title={label}>
      <ButtonBase
        aria-label={t("collections.sync.title")}
        onClick={(e) => {
          // The card around it opens the collection.
          e.stopPropagation();
          onClick();
        }}
        sx={{ ...frame, "&:hover": { borderColor: "primary.main" } }}
      >
        {content}
      </ButtonBase>
    </Tooltip>
  );
}
