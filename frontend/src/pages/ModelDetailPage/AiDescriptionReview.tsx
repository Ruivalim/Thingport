import { useState } from "react";
import { useTranslation } from "react-i18next";
import AutoFixNormalIcon from "@mui/icons-material/AutoFixNormal";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import UndoIcon from "@mui/icons-material/Undo";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { UnauthorizedError } from "../../api/client";
import { aiDescriptionsApi } from "../../api/aiDescriptions";
import { type Print, printsApi } from "../../api/prints";
import { useConfirm } from "../../components/ConfirmProvider";
import { useToast } from "../../components/ToastProvider";
import DescriptionCompareDialog from "../AiPage/DescriptionCompareDialog";

type Props = {
  print: Print;
  onUpdated: (print: Print) => void;
  onUnauthorized?: () => void;
};

/** Accepting, rejecting and reverting a model's AI description, then showing the model as it is after. */
function useDescriptionActions({ print, onUpdated, onUnauthorized }: Props) {
  const { t } = useTranslation(["models", "app"]);
  const confirm = useConfirm();
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);

  const act = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      onUpdated(await printsApi.get(print.id));
      setComparing(false);
      showToast({ message: done });
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else showToast({ message: err instanceof Error ? err.message : String(err), severity: "error" });
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    comparing,
    setComparing,
    accept: () => act(() => aiDescriptionsApi.accept(print.id), t("models:aiDescriptions.accepted")),
    reject: () => act(() => aiDescriptionsApi.reject(print.id), t("models:aiDescriptions.rejected")),
    revert: async () => {
      const ok = await confirm({
        title: t("app:adminSettings.aiDescriptions.revertTitle"),
        message: t("models:aiDescriptions.revertMessage"),
        confirmLabel: t("app:adminSettings.aiDescriptions.revert"),
      });
      if (ok) await act(() => aiDescriptionsApi.revert(print.id), t("app:adminSettings.aiDescriptions.revertDone"));
    },
  };
}

/**
 * "by AI" beside the Description heading, as beside an AI category. While the feature is on, it opens Compare and
 * Revert; switched off, the original isn't sent, so it only says where the text came from.
 */
export function AiDescriptionChip(props: Props) {
  const { print } = props;
  const { t } = useTranslation(["models", "app"]);
  const actions = useDescriptionActions(props);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!print.description_by_ai) return null;
  const original = print.ai_description_original;
  const label = t("models:aiCategorization.byAi");
  if (original == null) {
    return <Chip size="small" label={label} color="secondary" variant="outlined" />;
  }
  return (
    <>
      <Chip
        size="small"
        label={label}
        color="secondary"
        variant="outlined"
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-label={t("models:aiDescriptions.chipAria")}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            actions.setComparing(true);
          }}
        >
          <ListItemIcon>
            <CompareArrowsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("models:aiDescriptions.compareOriginal")}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={actions.busy}
          onClick={() => {
            setAnchor(null);
            void actions.revert();
          }}
        >
          <ListItemIcon>
            <UndoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("models:aiDescriptions.revertOriginal")}</ListItemText>
        </MenuItem>
      </Menu>
      {actions.comparing && (
        <DescriptionCompareDialog
          title={print.title || print.name}
          before={original}
          after={print.notes ?? ""}
          afterLabel={t("app:adminSettings.aiDescriptions.current")}
          onClose={() => actions.setComparing(false)}
          actions={
            <Button startIcon={<UndoIcon />} onClick={() => void actions.revert()} disabled={actions.busy}>
              {t("app:adminSettings.aiDescriptions.revert")}
            </Button>
          }
        />
      )}
    </>
  );
}

/**
 * A suggested rewrite under the description, to compare and accept or reject. Its owner reviews it here, as Manage
 * is the admin's.
 */
export default function AiDescriptionReview(props: Props) {
  const { print } = props;
  const { t } = useTranslation(["models", "app"]);
  const actions = useDescriptionActions(props);
  const suggestion = print.ai_description_suggestion;
  if (!suggestion) return null;

  return (
    <>
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          border: 1,
          borderColor: "info.main",
          borderRadius: "10px",
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(41, 182, 246, 0.08)" : "rgba(2, 136, 209, 0.05)"),
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <AutoFixNormalIcon fontSize="small" color="info" sx={{ mt: 0.25 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600}>
              {t("models:aiDescriptions.suggestionTitle")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("models:aiDescriptions.suggestionHint")}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Button size="small" startIcon={<CompareArrowsIcon />} onClick={() => actions.setComparing(true)}>
                {t("app:adminSettings.aiDescriptions.compare")}
              </Button>
              <Button size="small" variant="contained" onClick={() => void actions.accept()} disabled={actions.busy}>
                {t("app:adminSettings.aiDescriptions.accept")}
              </Button>
              <Button size="small" color="error" onClick={() => void actions.reject()} disabled={actions.busy}>
                {t("app:adminSettings.aiDescriptions.reject")}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
      {actions.comparing && (
        <DescriptionCompareDialog
          title={print.title || print.name}
          before={print.notes ?? ""}
          after={suggestion.notes}
          afterLabel={t("app:adminSettings.aiDescriptions.suggested")}
          onClose={() => actions.setComparing(false)}
          actions={
            <>
              <Button color="error" onClick={() => void actions.reject()} disabled={actions.busy}>
                {t("app:adminSettings.aiDescriptions.reject")}
              </Button>
              <Button variant="contained" onClick={() => void actions.accept()} disabled={actions.busy}>
                {t("app:adminSettings.aiDescriptions.accept")}
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
