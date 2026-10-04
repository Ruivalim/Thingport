import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { importsApi, type ImportJobItem } from "../../api/imports";

type Props = {
  jobId: string;
  open: boolean;
  onClose: () => void;
};

const STATUS_COLOR: Record<ImportJobItem["status"], "default" | "success" | "warning" | "error"> = {
  PENDING: "default",
  RUNNING: "warning",
  DONE: "success",
  FAILED: "error",
};

const STATUS_LABEL: Record<ImportJobItem["status"], string> = {
  PENDING: "importProgress.itemPending",
  RUNNING: "importProgress.itemRunning",
  DONE: "importProgress.itemDone",
  FAILED: "importProgress.itemFailed",
};

function StatusIcon({ status }: { status: ImportJobItem["status"] }) {
  if (status === "RUNNING") return <CircularProgress size={16} />;
  if (status === "DONE") return <CheckCircleIcon fontSize="small" color="success" />;
  if (status === "FAILED") return <ErrorIcon fontSize="small" color="error" />;
  return <ScheduleIcon fontSize="small" color="disabled" />;
}

/** The queue behind the progress bar: one row per pasted link, with why it failed. Opened by
 *  clicking the bar, so a batch's failures are visible without waiting on the notification. */
export default function ImportJobItemsDialog({ jobId, open, onClose }: Props) {
  const { t } = useTranslation("app");
  const [items, setItems] = useState<ImportJobItem[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await importsApi.getImportJobItems(jobId);
        if (!cancelled) setItems(loaded);
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    void load();
    const timer = window.setInterval(load, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, jobId]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("importProgress.queueTitle")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          {(items ?? []).map((item) => (
            <Stack key={item.id} direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ pt: 0.25 }}>
                <StatusIcon status={item.status} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                  {item.url}
                </Typography>
                {item.error_message && (
                  <Typography variant="caption" color="error" component="div" sx={{ wordBreak: "break-word" }}>
                    {item.error_message}
                  </Typography>
                )}
              </Box>
              <Chip
                size="small"
                color={STATUS_COLOR[item.status]}
                variant={item.status === "PENDING" ? "outlined" : "filled"}
                label={t(STATUS_LABEL[item.status])}
              />
            </Stack>
          ))}
          {items && !items.length && (
            <Typography variant="body2" color="text.secondary">
              {t("importProgress.queueEmpty")}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("importProgress.queueClose")}</Button>
      </DialogActions>
    </Dialog>
  );
}
