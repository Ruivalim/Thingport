import React from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import { UnauthorizedError } from "../../../api/client";
import { activityApi, type ActivityItem, type ActivityKind, type ActivityMonth } from "../../../api/activity";
import { printsApi } from "../../../api/prints";
import { useInfiniteScroll } from "../../../hooks/useInfiniteScroll";

const KIND_ICONS: Record<ActivityKind, React.ReactNode> = {
  import: <CloudDownloadOutlinedIcon fontSize="small" />,
  upload: <FileUploadOutlinedIcon fontSize="small" />,
  download: <DownloadOutlinedIcon fontSize="small" />,
  slicer: <LaunchOutlinedIcon fontSize="small" />,
  delete: <DeleteOutlineIcon fontSize="small" />,
};
// Longer groups fold the rest behind "Show more".
const ITEMS_SHOWN = 5;
const ICON_SIZE = 32;

// Neutral: the theme's hover colour is tinted green.
const chipBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)");

type Props = {
  /** YYYY-MM to start from, going back in time. */
  startMonth: string;
  /** A day picked on the heatmap: the timeline starts there, leaving out the days after it. */
  fromDay: string | null;
  onClearDay: () => void;
  onUnauthorized?: () => void;
};

/** GitHub's contribution activity: month by month, each kind of activity with its models, loading
 *  older months as the page scrolls. */
export default function Timeline({ startMonth, fromDay, onClearDay, onUnauthorized }: Props) {
  const { t, i18n } = useTranslation("app");
  const [months, setMonths] = React.useState<ActivityMonth[]>([]);
  // The next month to load: undefined until the first answer, null once there's no more.
  const [next, setNext] = React.useState<string | null | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Bumped on every restart, so a month still loading for the previous start is dropped.
  const generationRef = React.useRef(0);

  const load = React.useCallback(
    async (month: string, reset: boolean, until?: string) => {
      const generation = reset ? ++generationRef.current : generationRef.current;
      setLoading(true);
      setError(null);
      try {
        const data = await activityApi.getMonth(month, until);
        if (generation !== generationRef.current) return;
        setMonths((current) => (reset ? [data] : [...current, data]));
        setNext(data.next_month);
      } catch (err) {
        if (generation !== generationRef.current) return;
        if (err instanceof UnauthorizedError) onUnauthorized?.();
        else setError(t("activity.loadError"));
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    },
    [onUnauthorized, t],
  );

  React.useEffect(() => {
    setMonths([]);
    setNext(undefined);
    void load(startMonth, true, fromDay ?? undefined);
  }, [startMonth, fromDay, load]);

  const loadMore = React.useCallback(() => {
    if (next) void load(next, false);
  }, [next, load]);
  const sentinelRef = useInfiniteScroll(loadMore, Boolean(next), loading);

  const monthTitle = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone: "UTC" });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: (theme) => theme.thingport.headingText }}>
          {t("activity.timeline.title")}
        </Typography>
        {fromDay && (
          <Chip
            size="small"
            label={t("activity.timeline.fromDay", { date: longDate.format(new Date(`${fromDay}T00:00:00Z`)) })}
            onDelete={onClearDay}
          />
        )}
      </Stack>
      {months.map((month, index) => (
        <Box key={month.month} sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
            <Typography variant="caption" fontWeight={700} sx={{ flexShrink: 0, color: "text.secondary" }}>
              {monthTitle.format(new Date(`${month.month}-01T00:00:00Z`))}
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Stack>
          {month.groups.length === 0
            ? // Only the first month can be empty: later ones are skipped by the server.
              index === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 1, pb: 1 }}>
                  {fromDay ? t("activity.timeline.emptyUntil") : t("activity.timeline.emptyMonth")}
                </Typography>
              )
            : month.groups.map((group) => <TimelineGroup key={group.kind} {...group} />)}
        </Box>
      ))}
      {error && (
        <Alert severity="error" sx={{ my: 1 }}>
          {error}
        </Alert>
      )}
      {loading && (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={20} />
        </Stack>
      )}
      {next === null && months.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 2 }}>
          {t("activity.timeline.end")}
        </Typography>
      )}
      <Box ref={sentinelRef} />
    </Box>
  );
}

function TimelineGroup({ kind, total, items }: ActivityMonth["groups"][number]) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = React.useState(false);
  const shown = expanded ? items : items.slice(0, ITEMS_SHOWN);
  // "Downloaded 3 models", and how many times when that's more than once each.
  const models = items.reduce((sum, item) => sum + (item.name === null ? item.count : 1), 0);

  return (
    <Box sx={{ display: "flex", gap: 1.5 }}>
      {/* The line down the side, with the kind's icon on it. */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <Box
          sx={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: chipBg,
            color: "text.secondary",
          }}
        >
          {KIND_ICONS[kind]}
        </Box>
        <Box sx={{ flex: 1, width: "2px", bgcolor: "divider", minHeight: 12 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pb: 2 }}>
        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: `${ICON_SIZE}px` }}>
          {t(`activity.timeline.${kind}`, { count: models })}
          {total > models && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75 }}>
              {t("activity.timeline.times", { count: total })}
            </Typography>
          )}
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 0.5 }}>
          {shown.map((item) => (
            <TimelineItem key={`${item.print_id ?? item.name ?? "unknown"}`} item={item} />
          ))}
        </Stack>
        {items.length > ITEMS_SHOWN && (
          <Button size="small" onClick={() => setExpanded((value) => !value)} sx={{ mt: 0.5, px: 0.5 }}>
            {expanded
              ? t("activity.timeline.showLess")
              : t("activity.timeline.showMore", { count: items.length - ITEMS_SHOWN })}
          </Button>
        )}
      </Box>
    </Box>
  );
}

function TimelineItem({ item }: { item: ActivityItem }) {
  const { t, i18n } = useTranslation("app");
  const [thumbFailed, setThumbFailed] = React.useState(false);
  const day = new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" }).format(new Date(item.last_at));
  const name = item.name ?? t("activity.timeline.unknownModel");
  const linked = item.exists && item.print_id;

  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      {/* A deleted model is shown by its name alone; the empty box keeps names in line. */}
      {!item.exists && <Box sx={{ width: 32, height: 32, flexShrink: 0 }} />}
      {item.exists && (
        <Box
          component={RouterLink}
          to={`/models/${item.print_id}`}
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: "6px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: chipBg,
            color: "text.disabled",
          }}
        >
          {item.thumb_url && !thumbFailed ? (
            <Box
              component="img"
              src={printsApi.fileUrl(item.thumb_url)}
              alt=""
              loading="lazy"
              onError={() => setThumbFailed(true)}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <ViewInArIcon sx={{ fontSize: 16 }} />
          )}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {linked ? (
          <Link
            component={RouterLink}
            to={`/models/${item.print_id}`}
            variant="body2"
            underline="hover"
            noWrap
            sx={{ display: "block" }}
          >
            {name}
          </Link>
        ) : (
          <Typography variant="body2" color="text.secondary" noWrap>
            {name}
          </Typography>
        )}
      </Box>
      {item.count > 1 && (
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {t("activity.timeline.count", { count: item.count })}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, minWidth: 48, textAlign: "right" }}>
        {day}
      </Typography>
    </Stack>
  );
}
