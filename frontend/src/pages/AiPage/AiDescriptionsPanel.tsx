import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import UndoIcon from "@mui/icons-material/Undo";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { aiDescriptionsApi, type AiDescriptionApplied, type AiDescriptionSuggestion } from "../../api/aiDescriptions";
import { useConfirm } from "../../components/ConfirmProvider";
import { useAiDescriptionRun } from "../../components/Layout/AiRunContext";
import { ListRowSkeletons } from "../../components/ListSkeleton";
import { useToast } from "../../components/ToastProvider";
import DescriptionCompareDialog from "./DescriptionCompareDialog";

type Props = {
  onUnauthorized?: () => void;
  /** Closes the dialog once a run starts: its progress shows at the bottom of the app. */
  onRunStarted?: () => void;
};

const PAGE = 50;

/** The start of a description as one line, for a list row. */
function snippet(markdown: string): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

type Comparing =
  { kind: "suggestion"; item: AiDescriptionSuggestion } | { kind: "applied"; item: AiDescriptionApplied };

/** Improved descriptions' library run above the suggestions to review and the rewrites already applied. */
export default function AiDescriptionsPanel({ onUnauthorized, onRunStarted }: Props) {
  const { t } = useTranslation(["app", "common"]);
  const showToast = useToast();
  const confirm = useConfirm();
  const { running, startRun } = useAiDescriptionRun();
  const [suggestions, setSuggestions] = useState<{ total: number; items: AiDescriptionSuggestion[] } | null>(null);
  const [applied, setApplied] = useState<{ total: number; items: AiDescriptionApplied[] } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState<Comparing | null>(null);

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else showToast({ message: err instanceof Error ? err.message : String(err), severity: "error" });
    },
    [onUnauthorized, showToast],
  );

  const load = useCallback(async () => {
    const [pending, done] = await Promise.all([
      aiDescriptionsApi.suggestions(PAGE, 0),
      aiDescriptionsApi.applied(PAGE, 0),
    ]);
    setSuggestions(pending);
    setApplied(done);
    setSelected([]);
  }, []);

  // Again whenever a run stops, since a run adds suggestions.
  useEffect(() => {
    if (running) return;
    void load().catch(fail);
  }, [running, load, fail]);

  const act = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      await load();
      setComparing(null);
      showToast({ message: done });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  const accept = (ids: string[]) =>
    act(
      () => (ids.length === 1 ? aiDescriptionsApi.accept(ids[0]) : aiDescriptionsApi.bulk("accept", ids)),
      t("adminSettings.aiDescriptions.acceptDone", { count: ids.length }),
    );
  const reject = (ids: string[]) =>
    act(
      () => (ids.length === 1 ? aiDescriptionsApi.reject(ids[0]) : aiDescriptionsApi.bulk("reject", ids)),
      t("adminSettings.aiDescriptions.rejectDone", { count: ids.length }),
    );
  const revert = async (item: AiDescriptionApplied) => {
    const ok = await confirm({
      title: t("adminSettings.aiDescriptions.revertTitle"),
      message: t("adminSettings.aiDescriptions.revertMessage", { name: item.title || item.name }),
      confirmLabel: t("adminSettings.aiDescriptions.revert"),
    });
    if (ok) await act(() => aiDescriptionsApi.revert(item.id), t("adminSettings.aiDescriptions.revertDone"));
  };

  const start = async () => {
    setBusy(true);
    try {
      await startRun();
      onRunStarted?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const items = suggestions?.items ?? [];
  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));
  const rowSx = { gap: 1, flexWrap: { xs: "wrap", sm: "nowrap" } } as const;
  const actionsSx = {
    flexShrink: 0,
    pt: 0.5,
    // On a phone the actions take their own line instead of squeezing the text.
    flexBasis: { xs: "100%", sm: "auto" },
    justifyContent: "flex-end",
  } as const;

  return (
    <>
      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
        <Typography variant="body2" fontWeight={600}>
          {t("adminSettings.aiDescriptions.runTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("adminSettings.aiDescriptions.runHint")}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            size="small"
            variant="contained"
            startIcon={busy && !suggestions ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            onClick={() => void start()}
            disabled={busy || running}
          >
            {t("adminSettings.aiDescriptions.start")}
          </Button>
          {running && (
            <Typography variant="caption" color="text.secondary">
              {t("adminSettings.aiDescriptions.runInProgress")}
            </Typography>
          )}
        </Stack>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        {t("adminSettings.aiDescriptions.suggestionsTitle", { count: suggestions?.total ?? 0 })}
      </Typography>
      {!suggestions ? (
        <ListRowSkeletons count={3} lead="rounded" leadSize={24} twoLines trailing />
      ) : items.length ? (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              onClick={() => setSelected(selected.length === items.length ? [] : items.map((item) => item.id))}
            >
              {selected.length === items.length
                ? t("adminSettings.aiDescriptions.deselectAll")
                : t("adminSettings.aiDescriptions.selectAll")}
            </Button>
            <Button
              size="small"
              startIcon={<CheckIcon />}
              onClick={() => void accept(selected)}
              disabled={!selected.length || busy}
            >
              {t("adminSettings.aiDescriptions.acceptSelected")}
            </Button>
            <Button
              size="small"
              startIcon={<CloseIcon />}
              onClick={() => void reject(selected)}
              disabled={!selected.length || busy}
            >
              {t("adminSettings.aiDescriptions.rejectSelected")}
            </Button>
          </Stack>
          <List dense>
            {items.map((item) => (
              <ListItem key={item.id} divider alignItems="flex-start" sx={rowSx}>
                <Checkbox checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                <ListItemText
                  sx={{ flex: "1 1 0", minWidth: 0 }}
                  primary={item.title || item.name}
                  secondary={snippet(item.suggested)}
                />
                <Stack direction="row" spacing={0.5} sx={actionsSx}>
                  <Button
                    size="small"
                    startIcon={<CompareArrowsIcon />}
                    onClick={() => setComparing({ kind: "suggestion", item })}
                  >
                    {t("adminSettings.aiDescriptions.compare")}
                  </Button>
                  <Button size="small" onClick={() => void accept([item.id])} disabled={busy}>
                    {t("adminSettings.aiDescriptions.accept")}
                  </Button>
                  <Button size="small" color="error" onClick={() => void reject([item.id])} disabled={busy}>
                    {t("adminSettings.aiDescriptions.reject")}
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </List>
          {suggestions.total > items.length && (
            <Typography variant="caption" color="text.secondary">
              {t("adminSettings.aiDescriptions.firstPage", { shown: items.length, total: suggestions.total })}
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("adminSettings.aiDescriptions.noSuggestions")}
        </Typography>
      )}

      {Boolean(applied?.items.length) && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            {t("adminSettings.aiDescriptions.appliedTitle", { count: applied?.total ?? 0 })}
          </Typography>
          <List dense>
            {applied?.items.map((item) => (
              <ListItem key={item.id} divider alignItems="flex-start" sx={rowSx}>
                <ListItemText
                  sx={{ flex: "1 1 0", minWidth: 0 }}
                  primary={item.title || item.name}
                  secondary={snippet(item.current)}
                />
                <Stack direction="row" spacing={0.5} sx={actionsSx}>
                  <Button
                    size="small"
                    startIcon={<CompareArrowsIcon />}
                    onClick={() => setComparing({ kind: "applied", item })}
                  >
                    {t("adminSettings.aiDescriptions.compare")}
                  </Button>
                  <Button size="small" startIcon={<UndoIcon />} onClick={() => void revert(item)} disabled={busy}>
                    {t("adminSettings.aiDescriptions.revert")}
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {comparing?.kind === "suggestion" && (
        <DescriptionCompareDialog
          title={comparing.item.title || comparing.item.name}
          before={comparing.item.original}
          after={comparing.item.suggested}
          afterLabel={t("adminSettings.aiDescriptions.suggested")}
          onClose={() => setComparing(null)}
          actions={
            <>
              <Button color="error" onClick={() => void reject([comparing.item.id])} disabled={busy}>
                {t("adminSettings.aiDescriptions.reject")}
              </Button>
              <Button variant="contained" onClick={() => void accept([comparing.item.id])} disabled={busy}>
                {t("adminSettings.aiDescriptions.accept")}
              </Button>
            </>
          }
        />
      )}
      {comparing?.kind === "applied" && (
        <DescriptionCompareDialog
          title={comparing.item.title || comparing.item.name}
          before={comparing.item.original}
          after={comparing.item.current}
          afterLabel={t("adminSettings.aiDescriptions.current")}
          onClose={() => setComparing(null)}
          actions={
            <Button startIcon={<UndoIcon />} onClick={() => void revert(comparing.item)} disabled={busy}>
              {t("adminSettings.aiDescriptions.revert")}
            </Button>
          }
        />
      )}
    </>
  );
}
