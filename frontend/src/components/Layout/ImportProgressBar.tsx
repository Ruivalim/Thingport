import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import { useImportJob } from "./ImportJobContext";

/** Shown while a batch import runs; hovering shows the full breakdown. A link queue that finished
 *  with failures stays up with a retry button until it's dismissed. */
export default function ImportProgressBar() {
  const { t } = useTranslation("app");
  const { activeJob, retryJob, dismissJob } = useImportJob();
  if (!activeJob) return null;

  const { total, processed, imported, already_in_library: alreadyInLibrary, failed_count: failedCount } = activeJob;
  const progressValue = total > 0 ? Math.min(100, (processed / total) * 100) : 0;
  const running = activeJob.status === "RUNNING";
  const label = running
    ? total > 0
      ? t("importProgress.label", { processed, total })
      : t("importProgress.starting")
    : t("importProgress.doneWithFailures", { imported, alreadyInLibrary, failedCount });
  const tooltip = t("importProgress.tooltip", { imported, alreadyInLibrary, failedCount });

  return (
    <Tooltip title={tooltip} placement="top">
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.snackbar,
          bgcolor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
          px: 2,
          py: 0.75,
        }}
      >
        <Stack spacing={0.5} sx={{ maxWidth: 480, mx: "auto" }}>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            {label}
          </Typography>
          {running ? (
            <LinearProgress
              variant={total > 0 ? "determinate" : "indeterminate"}
              value={progressValue}
              sx={{ borderRadius: 1, height: 6 }}
            />
          ) : (
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <Button size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => void retryJob()}>
                {t("importProgress.retryFailed")}
              </Button>
              <IconButton size="small" aria-label={t("importProgress.dismiss")} onClick={dismissJob}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
        </Stack>
      </Box>
    </Tooltip>
  );
}
