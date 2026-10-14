import React from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import MarkdownDescription from "../../components/MarkdownDescription";

type Props = {
  title: string;
  before: string;
  after: string;
  /** What the right side is: a suggestion, or what's there now after an applied rewrite. */
  afterLabel: string;
  onClose: () => void;
  /** Buttons for what can be done with it, beside Close. */
  actions?: React.ReactNode;
};

function Column({ label, markdown }: { label: string; markdown: string }) {
  const { t } = useTranslation("app");
  return (
    <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          p: 2,
          border: 1,
          borderColor: "divider",
          borderRadius: "10px",
          maxHeight: { xs: "none", md: "60vh" },
        }}
      >
        {markdown.trim() ? (
          <MarkdownDescription markdown={markdown} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("adminSettings.aiDescriptions.empty")}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** A description before and after the AI, side by side (stacked on a phone). */
export default function DescriptionCompareDialog({ title, before, after, afterLabel, onClose, actions }: Props) {
  const { t } = useTranslation(["app", "common"]);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Column label={t("adminSettings.aiDescriptions.original")} markdown={before} />
          <Column label={afterLabel} markdown={after} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {actions}
        <Button onClick={onClose}>{t("common:close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
