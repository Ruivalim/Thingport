import { useEffect, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { keyframes } from "@emotion/react";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import CircularProgress from "@mui/material/CircularProgress";
import HighlightAltIcon from "@mui/icons-material/HighlightAlt";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import PlaylistRemoveIcon from "@mui/icons-material/PlaylistRemove";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutoFixNormalIcon from "@mui/icons-material/AutoFixNormal";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import DeselectIcon from "@mui/icons-material/Deselect";
import { UnauthorizedError } from "../../api/client";
import { type Print, printsApi } from "../../api/prints";
import { AiCategorizationError, aiCategorizationApi } from "../../api/aiCategorization";
import { aiDescriptionsApi } from "../../api/aiDescriptions";
import { collectionsApi } from "../../api/collections";
import type { ModelSelection } from "../../hooks/useModelSelection";
import { useAiDescriptionRun, useAiRun } from "../Layout/AiRunContext";
import { useConfirm } from "../ConfirmProvider";
import { useToast } from "../ToastProvider";
import DownloadZipConfirmDialog from "../DownloadZipConfirmDialog";
import BulkAddToCollectionDialog from "./BulkAddToCollectionDialog";

type Props = {
  selection: ModelSelection;
  /** Models the grid has loaded: "select all" takes these. */
  total: number;
  /** More are still to load, so "select all" says it only takes the loaded ones. */
  hasMore?: boolean;
  onDeleted: (ids: string[]) => void;
  onUpdated: (prints: Print[]) => void;
  onUnauthorized?: () => void;
  /** Only for a real collection; shows "Remove from collection". */
  collectionId?: string;
  onRemovedFromCollection?: (ids: string[]) => void;
};

type Busy = "favorite" | "removeFromCollection" | "delete" | "ai" | null;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: none; }
`;

/** A grid's select-mode toggle and, while it's on, the actions for the selected models. */
export default function ModelSelectionToolbar({
  selection,
  total,
  hasMore = false,
  onDeleted,
  onUpdated,
  onUnauthorized,
  collectionId,
  onRemovedFromCollection,
}: Props) {
  const { t } = useTranslation(["models", "common"]);
  const confirm = useConfirm();
  const showToast = useToast();
  const categorization = useAiRun();
  const descriptions = useAiDescriptionRun();
  const [aiEnabled, setAiEnabled] = useState(false);
  const [descriptionsEnabled, setDescriptionsEnabled] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [aiMenuAnchor, setAiMenuAnchor] = useState<HTMLElement | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const { active, selected } = selection;
  const ids = selected.map((item) => item.id);
  const count = ids.length;
  const allSelected = count > 0 && count === total;
  const allFavorite = count > 0 && selected.every((item) => item.is_favorite);
  const disabled = count === 0 || busy !== null;

  // Both statuses are cached for the session, so this costs nothing after the first grid.
  useEffect(() => {
    if (!active) return;
    let live = true;
    void aiCategorizationApi
      .status()
      .then((status) => live && setAiEnabled(status.enabled))
      .catch(() => undefined);
    void aiDescriptionsApi
      .status()
      .then((status) => live && setDescriptionsEnabled(status.enabled))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [active]);

  const failed = (err: unknown, fallback: string) => {
    if (err instanceof UnauthorizedError) {
      onUnauthorized?.();
      return;
    }
    console.error(err);
    showToast({ message: err instanceof Error ? err.message : fallback, severity: "error" });
  };

  const toggleFavorite = async () => {
    setBusy("favorite");
    const favorite = !allFavorite;
    try {
      onUpdated(await printsApi.bulkFavorite(ids, favorite));
      showToast({
        message: t(favorite ? "models:selection.favorited" : "models:selection.unfavorited", { count }),
      });
    } catch (err) {
      failed(err, t("models:detail.favoriteFailed"));
    } finally {
      setBusy(null);
    }
  };

  const removeFromCollection = async () => {
    if (!collectionId) return;
    const confirmed = await confirm({
      message: t("models:selection.confirmRemoveFromCollection", { count }),
      confirmLabel: t("common:remove"),
    });
    if (!confirmed) return;
    setBusy("removeFromCollection");
    try {
      await collectionsApi.removeItems(collectionId, ids);
      onRemovedFromCollection?.(ids);
      showToast({ message: t("models:selection.removedFromCollection", { count }) });
    } catch (err) {
      failed(err, t("models:detail.removeFromCollectionFailed"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const confirmed = await confirm({
      message: t("models:selection.confirmDelete", { count }),
      destructive: true,
    });
    if (!confirmed) return;
    setBusy("delete");
    try {
      const result = await printsApi.bulkDelete(ids);
      onDeleted(result.deleted);
      if (result.failed) {
        showToast({ message: t("models:selection.deletePartlyFailed", { count: result.failed }), severity: "error" });
      } else {
        showToast({ message: t("models:selection.deleted", { count: result.deleted.length }) });
      }
    } catch (err) {
      failed(err, t("models:detail.deleteFailed"));
    } finally {
      setBusy(null);
    }
  };

  const runFailed = (err: unknown, fallback: string) => {
    if (err instanceof AiCategorizationError && err.code === "running") {
      showToast({ message: t("models:selection.aiRunActive"), severity: "warning" });
    } else failed(err, fallback);
  };

  const categorize = async () => {
    setAiMenuAnchor(null);
    // Ones with a category picked by hand, or set before anything recorded how: replacing those is the user's call.
    const handPicked = selected.filter(
      (item) =>
        item.category_id &&
        item.category_kind !== "folder" &&
        item.category_source !== "ai" &&
        item.category_source !== "rule",
    ).length;
    const includeManual =
      handPicked > 0 &&
      (await confirm({
        message: t("models:selection.confirmManual", { count: handPicked }),
        confirmLabel: t("models:selection.includeManual"),
        cancelLabel: t("models:selection.skipManual"),
      }));
    setBusy("ai");
    try {
      await categorization.startRun({
        include_uncategorized: true,
        include_folders: true,
        include_ai: true,
        include_rule: true,
        include_manual: includeManual,
        print_ids: ids,
      });
      showToast({ message: t("models:selection.categorizeQueued", { count }) });
    } catch (err) {
      runFailed(err, t("models:aiCategorization.failed"));
    } finally {
      setBusy(null);
    }
  };

  const improveDescriptions = async () => {
    setAiMenuAnchor(null);
    setBusy("ai");
    try {
      await descriptions.startRun(ids);
      showToast({ message: t("models:selection.improveQueued", { count }) });
    } catch (err) {
      runFailed(err, t("models:aiDescriptions.failed"));
    } finally {
      setBusy(null);
    }
  };

  const action = (label: string, icon: React.ReactNode, onClick: (e: React.MouseEvent<HTMLElement>) => void) => (
    <Tooltip title={label}>
      {/* A disabled button fires no events, so the span keeps the tooltip working. */}
      <span>
        <IconButton size="small" aria-label={label} disabled={disabled} onClick={onClick}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  const favoriteLabel = allFavorite ? t("models:detail.removeFromFavorites") : t("models:detail.addToFavorites");
  const selectAllLabel = allSelected
    ? t("common:clearSelection")
    : hasMore
      ? t("models:selection.selectAllLoaded")
      : t("common:selectAll");
  const toggleLabel = active ? t("models:selection.exit") : t("models:selection.enter");

  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
      <Tooltip title={toggleLabel}>
        <ToggleButton
          value="select"
          size="small"
          selected={active}
          onChange={() => selection.setActive(!active)}
          aria-label={toggleLabel}
          sx={{ px: 1 }}
        >
          <HighlightAltIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      {active && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.25}
          role="toolbar"
          aria-label={t("models:selection.toolbar")}
          sx={{
            animation: `${slideIn} 200ms ease-out`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          {action(t("models:detail.addToCollection"), <PlaylistAddIcon fontSize="small" />, () => setAddOpen(true))}
          {collectionId &&
            action(
              t("models:detail.removeFromCollection"),
              busy === "removeFromCollection" ? (
                <CircularProgress size={18} />
              ) : (
                <PlaylistRemoveIcon fontSize="small" />
              ),
              () => void removeFromCollection(),
            )}
          {action(
            favoriteLabel,
            busy === "favorite" ? (
              <CircularProgress size={18} />
            ) : allFavorite ? (
              <StarIcon fontSize="small" sx={{ color: "warning.main" }} />
            ) : (
              <StarBorderIcon fontSize="small" />
            ),
            () => void toggleFavorite(),
          )}
          {action(t("common:download"), <DownloadIcon fontSize="small" />, () => setDownloadOpen(true))}
          {action(
            t("common:delete"),
            busy === "delete" ? (
              <CircularProgress size={18} />
            ) : (
              <DeleteOutlineIcon fontSize="small" color={disabled ? undefined : "error"} />
            ),
            () => void remove(),
          )}
          {(aiEnabled || descriptionsEnabled) &&
            action(
              t("models:selection.aiActions"),
              busy === "ai" ? <CircularProgress size={18} /> : <AutoAwesomeIcon fontSize="small" />,
              (e) => setAiMenuAnchor(e.currentTarget),
            )}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.75 }} />
          <Typography
            variant="caption"
            aria-live="polite"
            sx={{ color: "text.secondary", whiteSpace: "nowrap", minWidth: 64 }}
          >
            {t("models:selection.count", { count })}
          </Typography>
          <Tooltip title={selectAllLabel}>
            <span>
              <IconButton
                size="small"
                aria-label={selectAllLabel}
                disabled={total === 0 || busy !== null}
                onClick={allSelected ? selection.clear : selection.selectAll}
              >
                {allSelected ? <DeselectIcon fontSize="small" /> : <SelectAllIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      )}

      <Menu anchorEl={aiMenuAnchor} open={Boolean(aiMenuAnchor)} onClose={() => setAiMenuAnchor(null)}>
        {aiEnabled && (
          <MenuItem onClick={() => void categorize()} disabled={categorization.running}>
            <ListItemIcon>
              <AutoAwesomeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText secondary={categorization.running ? t("models:selection.aiRunActive") : undefined}>
              {t("models:aiCategorization.categorize")}
            </ListItemText>
          </MenuItem>
        )}
        {descriptionsEnabled && (
          <MenuItem onClick={() => void improveDescriptions()} disabled={descriptions.running}>
            <ListItemIcon>
              <AutoFixNormalIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText secondary={descriptions.running ? t("models:selection.aiRunActive") : undefined}>
              {t("models:selection.improveDescriptions")}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>

      <BulkAddToCollectionDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        printIds={ids}
        onUnauthorized={onUnauthorized}
      />
      <DownloadZipConfirmDialog
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        filter={{ print_ids: ids }}
        filename="thingport.zip"
        title={t("models:selection.downloadTitle", { count })}
        onUnauthorized={onUnauthorized}
      />
    </Stack>
  );
}
