import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SyncIcon from "@mui/icons-material/Sync";
import SyncDisabledIcon from "@mui/icons-material/SyncDisabled";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import { UnauthorizedError } from "../../api/client";
import {
  type Collection,
  type SyncIntervalHours,
  type SyncProfileScope,
  SYNC_INTERVAL_HOURS,
  collectionsApi,
} from "../../api/collections";
import { useConfirm } from "../../components/ConfirmProvider";
import { useToast } from "../../components/ToastProvider";
import { importProviderInfo } from "../../constants/importProviders";
import { relativeTime } from "../../utils/relativeTime";
import SectionedDialog, { type DialogSection } from "../../components/SectionedDialog";
import SyncChain from "./SyncChain";
import HelpTip from "../../components/HelpTip";
import Segmented from "../../components/controls/Segmented";
import { SectionLabel } from "../../components/Layout/ConfigurationDialog/parts";

const SCOPES: SyncProfileScope[] = ["url", "designer", "all"];

type SyncSection = "overview" | "settings";

type Props = {
  collection: Collection & { sync: NonNullable<Collection["sync"]> };
  onClose: () => void;
  onUpdated: (collection: Collection) => void;
  onUnauthorized?: () => void;
};

/** Ticks every second while `until` is in the future, so a countdown can redraw. */
function useNowUntil(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null || until <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return now;
}

/** "21:30", or "Fri 09:00" when it isn't today. */
function clockTime(iso: string, locale: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(locale, {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesSeconds(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** A synced collection's sync, in two sections like the app's Configuration: Overview (the link,
 *  its status, Sync now and Stop syncing) and Settings (how often it's checked and, for MakerWorld,
 *  which print profiles each new model brings). */
export default function CollectionSyncDialog({ collection, onClose, onUpdated, onUnauthorized }: Props) {
  const { t, i18n } = useTranslation(["models", "common"]);
  const confirm = useConfirm();
  const showToast = useToast();
  const { sync } = collection;
  const provider = importProviderInfo(sync.provider)?.label ?? sync.provider;
  const hasProfiles = sync.provider === "makerworld";
  const [scope, setScope] = useState<SyncProfileScope>(sync.profile_scope);
  const [intervalHours, setIntervalHours] = useState<SyncIntervalHours>(sync.interval_hours);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<SyncSection>("overview");

  const readyAt = sync.sync_now_at ? new Date(sync.sync_now_at).getTime() : null;
  const now = useNowUntil(readyAt);
  const coolingMs = readyAt ? readyAt - now : 0;
  const cooling = coolingMs > 0;
  // How far through the cool-down, from the last check to when Sync now is back.
  const startedAt = sync.last_checked_at ? new Date(sync.last_checked_at).getTime() : null;
  const coolProgress =
    cooling && readyAt && startedAt && readyAt > startedAt ? ((now - startedAt) / (readyAt - startedAt)) * 100 : 0;

  /** Runs an action, keeping the dialog open on failure with the error shown. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
        return;
      }
      setError(err instanceof Error ? err.message : t("models:collections.sync.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    const ok = await confirm({
      title: t("models:collections.sync.syncNowTitle"),
      message: t("models:collections.sync.syncNowMessage", { name: collection.name, provider }),
      confirmLabel: t("models:collections.sync.syncNow"),
    });
    if (!ok) return;
    await run(async () => {
      const updated = await collectionsApi.runSync(collection.id);
      onUpdated({ ...collection, sync: updated });
      showToast({ message: t("models:collections.sync.syncNowStarted", { name: collection.name }) });
    });
  };

  const stop = async () => {
    const ok = await confirm({
      title: t("models:collections.sync.stopTitle"),
      message: t("models:collections.sync.stopMessage", { name: collection.name }),
      confirmLabel: t("models:collections.sync.stop"),
      destructive: true,
    });
    if (!ok) return;
    await run(async () => {
      await collectionsApi.stopSync(collection.id);
      showToast({ message: t("models:collections.sync.stopped", { name: collection.name }) });
      onUpdated({ ...collection, sync: null });
      onClose();
    });
  };

  /** Settings are saved as they're picked; a failed save puts the choice back. */
  const saveSetting = async (change: Parameters<typeof collectionsApi.updateSync>[1], revert: () => void) => {
    let saved = false;
    await run(async () => {
      const updated = await collectionsApi.updateSync(collection.id, change);
      saved = true;
      onUpdated({ ...collection, sync: updated });
      showToast({ message: t("models:collections.sync.saved") });
    });
    if (!saved) revert();
  };

  const changeScope = (next: SyncProfileScope) => {
    const previous = scope;
    setScope(next);
    void saveSetting({ profile_scope: next }, () => setScope(previous));
  };

  const changeInterval = (next: SyncIntervalHours) => {
    const previous = intervalHours;
    setIntervalHours(next);
    void saveSetting({ interval_hours: next }, () => setIntervalHours(previous));
  };

  const checked = sync.last_checked_at
    ? t("models:collections.sync.lastChecked", { when: relativeTime(sync.last_checked_at, i18n.language) })
    : t("models:collections.sync.notCheckedYet");
  const next = sync.next_sync_at
    ? t("models:collections.sync.nextSync", { time: clockTime(sync.next_sync_at, i18n.language) })
    : null;

  const sections: DialogSection<SyncSection>[] = [
    {
      id: "overview",
      label: t("models:collections.sync.sections.overview"),
      icon: <HubOutlinedIcon fontSize="small" />,
    },
    { id: "settings", label: t("models:collections.sync.sections.settings"), icon: <TuneIcon fontSize="small" /> },
  ];

  return (
    <SectionedDialog
      open
      onClose={busy ? () => undefined : onClose}
      title={t("models:collections.sync.title")}
      sections={sections}
      section={section}
      onSectionChange={setSection}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {section === "overview" && (
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2">
              {sync.likes_of
                ? t("models:collections.sync.introLikes", { user: sync.likes_of, count: sync.interval_hours })
                : t("models:collections.sync.intro", { provider, count: sync.interval_hours })}
            </Typography>
            <Link
              variant="body2"
              href={sync.source_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: "block", width: "fit-content" }}
            >
              {t("models:collections.sync.openSource", { provider })}
            </Link>
          </Box>
          <SyncChain
            collection={collection}
            syncNow={{
              label: t("models:collections.sync.syncNow"),
              icon: <SyncIcon fontSize="small" />,
              onClick: () => void syncNow(),
              disabled: busy || cooling,
              disabledLabel: cooling
                ? t("models:collections.sync.syncNowIn", { time: minutesSeconds(coolingMs) })
                : undefined,
              progress: cooling ? coolProgress : null,
            }}
            stop={{
              label: t("models:collections.sync.stop"),
              icon: <SyncDisabledIcon fontSize="small" />,
              onClick: () => void stop(),
              disabled: busy,
              color: "error",
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {next ? `${checked} · ${next}` : checked}
          </Typography>
          {sync.last_error && <Alert severity="warning">{sync.last_error}</Alert>}
        </Stack>
      )}

      {section === "settings" && (
        <Stack spacing={3}>
          <div>
            <SectionLabel>{t("models:collections.sync.intervalLabel")}</SectionLabel>
            <Segmented
              label={t("models:collections.sync.intervalLabel")}
              value={String(intervalHours)}
              onChange={(value) => changeInterval(Number(value) as SyncIntervalHours)}
              disabled={busy}
              options={SYNC_INTERVAL_HOURS.map((hours) => ({
                value: String(hours),
                label: t("models:collections.sync.intervalOption", { count: hours }),
              }))}
            />
          </div>
          {/* Only MakerWorld models have print profiles to choose between. */}
          {hasProfiles && (
            <div>
              <SectionLabel>
                {t("models:collections.sync.profilesLabel")}
                <HelpTip text={t("models:collections.sync.profilesHelp")} />
              </SectionLabel>
              <Segmented
                label={t("models:collections.sync.profilesLabel")}
                value={scope}
                onChange={changeScope}
                disabled={busy}
                options={SCOPES.map((value) => ({ value, label: t(`models:collections.sync.profiles.${value}`) }))}
              />
            </div>
          )}
        </Stack>
      )}
    </SectionedDialog>
  );
}
