import { useState } from "react";
import { useTranslation } from "react-i18next";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CategorizationAnimation from "../../pages/AiPage/CategorizationAnimation";
import DescriptionAnimation from "../../pages/AiPage/DescriptionAnimation";
import { useRotatingPhrase } from "../../hooks/useRotatingPhrase";
import { useAiDescriptionRun, useAiRun } from "./AiRunContext";

const MINI_TILE = 40;

/** Shown while an AI feature's library run goes; the outcome arrives as a notification once it's done. */
export default function AiRunProgressBar({ kind }: { kind: "categorization" | "descriptions" }) {
  const { t } = useTranslation("app");
  const categorization = useAiRun();
  const descriptions = useAiDescriptionRun();
  const { run, running, cancelRun } = kind === "categorization" ? categorization : descriptions;
  const strings = kind === "categorization" ? "aiRunProgress" : "aiRunProgress.descriptions";
  const Animation = kind === "categorization" ? CategorizationAnimation : DescriptionAnimation;
  const [stopping, setStopping] = useState(false);
  // A light touch on a long wait: the title changes every few seconds while the run goes.
  const phrase = useRotatingPhrase(`${strings}.phrases`, running);

  if (!run || !running) return null;
  const { done, total } = run;
  const title = run.cancelled
    ? t("aiRunProgress.stopping")
    : total > 0
      ? t(`${strings}.label`, { phrase, done, total })
      : t(`${strings}.starting`);

  return (
    <Box sx={{ bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider", px: 2, py: 0.75 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ maxWidth: 520, mx: "auto" }}>
        {/* The feature's own tile, small: which run this is at a glance. */}
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            width: MINI_TILE,
            height: MINI_TILE,
            borderRadius: "11px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#ffffff",
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
          }}
        >
          <Animation size={MINI_TILE - 6} paused={run.cancelled} />
        </Box>
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" noWrap sx={{ display: "block" }}>
            {title}
          </Typography>
          <LinearProgress
            variant={total > 0 ? "determinate" : "indeterminate"}
            value={total > 0 ? Math.min(100, (done / total) * 100) : 0}
            sx={{ borderRadius: 1, height: 6 }}
          />
        </Stack>
        <Tooltip title={t(`${strings}.stop`)}>
          <span>
            <IconButton
              size="small"
              aria-label={t(`${strings}.stop`)}
              disabled={stopping || run.cancelled}
              onClick={() => {
                setStopping(true);
                void cancelRun()
                  .catch(() => undefined)
                  .finally(() => setStopping(false));
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
