import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BookmarkletButton from "./BookmarkletButton";
import BookmarkletAnimation from "./importAnimations/BookmarkletAnimation";
import { THINGPORT_WEBSITE_URL } from "../constants/website";

const GUIDE_URL = `${THINGPORT_WEBSITE_URL}docs/guides/bookmarklet/`;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Goes to the Download page, for Thingport Grab. */
  onGetExtension: () => void;
};

/** How the bookmarklet works, shown, and the bookmarklet itself to drag to the bookmarks bar. */
export default function BookmarkletGuideDialog({ open, onClose, onGetExtension }: Props) {
  const { t } = useTranslation(["app", "common"]);
  const steps = t("bookmarklet.guide.steps", { returnObjects: true }) as string[];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("bookmarklet.guide.title")}</DialogTitle>
      <DialogContent>
        {/* Grab does more and some sites need it, so it's offered first. */}
        <Alert
          severity="info"
          icon={<ExtensionOutlinedIcon fontSize="small" />}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={onGetExtension} sx={{ whiteSpace: "nowrap" }}>
              {t("bookmarklet.guide.getExtension")}
            </Button>
          }
        >
          {t("bookmarklet.guide.extensionRecommended")}
        </Alert>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <BookmarkletAnimation width={280} />
        </Box>
        <Box
          component="ol"
          sx={{ m: 0, mb: 2, pl: 2.5, color: "text.secondary", fontSize: "0.8125rem", "& li": { mb: 0.75 } }}
        >
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </Box>
        <Stack alignItems="center" spacing={1}>
          <BookmarkletButton />
          <Typography variant="caption" color="text.secondary" align="center">
            {t("bookmarklet.guide.cantDrag")}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          component="a"
          href={GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{ mr: "auto" }}
        >
          {t("bookmarklet.guide.readMore")}
        </Button>
        <Button onClick={onClose}>{t("common:close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
