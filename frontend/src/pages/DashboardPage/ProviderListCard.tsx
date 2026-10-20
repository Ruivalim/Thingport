import { useTranslation } from "react-i18next";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Chip from "@mui/material/Chip";
import PublicIcon from "@mui/icons-material/Public";
import { printProviderInfo, providerChipSx } from "../../constants/importProviders";
import type { DashboardProvider } from "../../api/dashboard";
import { useProviderAbout } from "../../components/providerAbout/ProviderAboutProvider";

type Props = {
  providers: DashboardProvider[];
};

/** A small fixed set, so no "see more". A provider's chip opens its About dialog; Thingport's own (uploads) has none. */
export default function ProviderListCard({ providers }: Props) {
  const { t } = useTranslation("app");

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        borderColor: (theme) => (theme.palette.mode === "dark" ? "transparent" : "divider"),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, color: "primary.main" }}>
        <PublicIcon />
        <Typography variant="h6" fontWeight={700} sx={{ color: (theme) => theme.thingport.headingText }}>
          {t("dashboard.topProviders.title")}
        </Typography>
      </Box>

      {providers.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          {t("dashboard.topProviders.empty")}
        </Typography>
      ) : (
        <List dense disablePadding>
          {providers.map((p) => {
            return (
              <ListItem key={p.provider} sx={{ px: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: "100%" }}>
                  <ProviderChip provider={p.provider} />
                  <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, pl: 1 }}>
                    {t("dashboard.topProviders.modelCount", { count: p.model_count })}
                  </Typography>
                </Stack>
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}

function ProviderChip({ provider }: { provider: string | null }) {
  const { t } = useTranslation("app");
  const info = printProviderInfo(provider);
  const openAbout = useProviderAbout(provider);
  return (
    <Chip
      label={info.label}
      size="small"
      onClick={openAbout ?? undefined}
      aria-label={openAbout ? t("providerAbout.aboutName", { name: info.label }) : undefined}
      sx={{
        ...providerChipSx(info),
        fontWeight: 600,
        // MUI's clickable chip darkens on hover; keep the brand colour and lift it instead.
        "&.MuiChip-clickable:hover": { bgcolor: info.color, transform: "translateY(-1px)", boxShadow: 2 },
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&.MuiChip-clickable:hover": { transform: "none" },
        },
      }}
    />
  );
}
