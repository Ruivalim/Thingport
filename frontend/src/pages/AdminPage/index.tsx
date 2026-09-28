import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import HistoryIcon from "@mui/icons-material/History";
import BoltIcon from "@mui/icons-material/Bolt";
import CableIcon from "@mui/icons-material/Cable";
import PublicIcon from "@mui/icons-material/Public";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import UpdateCheckSection from "./UpdateCheckSection";
import { adminApi, type StorageUsage } from "../../api/admin";
import { UnauthorizedError } from "../../api/client";
import { formatFileSize } from "../../utils/fileSize";
import { THINGPORT_WEBSITE_URL } from "../../constants/website";

type Section = {
  path: string;
  icon: React.ReactNode;
  labelKey: string;
};

const SECTIONS: Section[] = [
  { path: "/admin-settings", icon: <SettingsIcon fontSize="small" />, labelKey: "common:settings" },
  { path: "/admin-rendering", icon: <ViewInArIcon fontSize="small" />, labelKey: "adminSettings.rendering.heading" },
  { path: "/admin-users", icon: <PeopleIcon fontSize="small" />, labelKey: "adminSettings.users.heading" },
  { path: "/admin-logs", icon: <HistoryIcon fontSize="small" />, labelKey: "adminSettings.logs.heading" },
  { path: "/admin-triggers", icon: <BoltIcon fontSize="small" />, labelKey: "adminSettings.triggers.heading" },
  { path: "/admin-connections", icon: <CableIcon fontSize="small" />, labelKey: "adminSettings.connections.heading" },
  { path: "/admin-captcha", icon: <VerifiedUserIcon fontSize="small" />, labelKey: "adminSettings.captcha.heading" },
];

type Props = {
  onUnauthorized?: () => void;
};

export default function AdminPage({ onUnauthorized }: Props) {
  const { t } = useTranslation(["app", "common"]);
  const navigate = useNavigate();
  // undefined = loading, null = failed (the footer hides).
  const [storage, setStorage] = useState<StorageUsage | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    adminApi.getStorageUsage().then(
      usage => { if (!cancelled) setStorage(usage); },
      err => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) onUnauthorized?.();
        setStorage(null);
      },
    );
    return () => { cancelled = true; };
  }, [onUnauthorized]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 480 }}>
      <UpdateCheckSection onUnauthorized={onUnauthorized} />
      <Paper
        variant="outlined"
        sx={{
          borderRadius: "12px",
          borderColor: (theme) => (theme.palette.mode === "dark" ? "transparent" : "divider"),
        }}
      >
        <List disablePadding>
          {SECTIONS.map((section, idx) => (
            <ListItemButton
              key={section.path}
              onClick={() => navigate(section.path)}
              divider={idx < SECTIONS.length - 1}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{section.icon}</ListItemIcon>
              <ListItemText primary={t(section.labelKey)} primaryTypographyProps={{ variant: "body2", fontWeight: 600 }} />
              <ChevronRightIcon fontSize="small" sx={{ color: "text.disabled" }} />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {storage !== null && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          title={t("adminSettings.storageUsage.hint")}
          sx={{ px: 0.5, color: "text.secondary" }}
        >
          <StorageIcon fontSize="small" />
          {storage === undefined ? (
            <Skeleton width={220} />
          ) : (
            <Typography variant="body2">
              {t("adminSettings.storageUsage.summary", {
                size: formatFileSize(storage.model_bytes),
                count: storage.model_count,
              })}
            </Typography>
          )}
        </Stack>
      )}

      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        title={t("adminSettings.website.hint")}
        sx={{ px: 0.5, color: "text.secondary" }}
      >
        <PublicIcon fontSize="small" />
        <Link href={THINGPORT_WEBSITE_URL} target="_blank" rel="noopener" variant="body2" underline="hover">
          {t("adminSettings.website.link")}
        </Link>
      </Stack>
    </Stack>
  );
}
