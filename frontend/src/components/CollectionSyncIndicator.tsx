import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import CheckIcon from "@mui/icons-material/Check";
import type { CollectionSync } from "../api/collections";
import { importProviderInfo } from "../constants/importProviders";
import { ProviderLogo, type ProviderId } from "./Layout/ConfigurationDialog/providerLogos";

const ICON_SIZE = 18;
const BUBBLE_SIZE = 10;
const LOGO_PROVIDERS = new Set<string>(["makerworld", "thingiverse", "printables"]);

/** The provider's logo with a small green tick, slim enough for a toolbar row. Opens the
 *  collection's sync configuration. */
export default function CollectionSyncIndicator({ sync, onClick }: { sync: CollectionSync; onClick: () => void }) {
  const { t } = useTranslation("models");
  const provider = importProviderInfo(sync.provider)?.label ?? sync.provider;
  const label = sync.likes_of
    ? t("collections.sync.badgeLikes", { user: sync.likes_of })
    : t("collections.sync.badge", { provider });
  return (
    <Tooltip title={label}>
      <ButtonBase
        aria-label={`${label}. ${t("collections.sync.title")}`}
        onClick={onClick}
        sx={{
          p: 0.5,
          // The padding is only for the hover background: cancelled out, the indicator takes no more
          // room than its icon, so the toolbar row it sits in doesn't grow.
          m: -0.5,
          borderRadius: "6px",
          transition: "background-color 150ms",
          "&:hover": { bgcolor: "action.hover" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
        }}
      >
        <Box sx={{ position: "relative", width: ICON_SIZE, height: ICON_SIZE }}>
          {LOGO_PROVIDERS.has(sync.provider) && <ProviderLogo id={sync.provider as ProviderId} size={ICON_SIZE} />}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              right: -BUBBLE_SIZE / 3,
              bottom: -BUBBLE_SIZE / 3,
              display: "grid",
              placeItems: "center",
              width: BUBBLE_SIZE,
              height: BUBBLE_SIZE,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "#fff",
              // A ring in the page's colour keeps the tick readable over the logo.
              boxShadow: (theme) => `0 0 0 1.5px ${theme.palette.background.default}`,
            }}
          >
            <CheckIcon sx={{ fontSize: 8 }} />
          </Box>
        </Box>
      </ButtonBase>
    </Tooltip>
  );
}
