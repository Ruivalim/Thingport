import { useTranslation } from "react-i18next";
import Tooltip from "@mui/material/Tooltip";
import LightbulbIcon from "@mui/icons-material/Lightbulb";

/** The "Open sanitized in <slicer>" icon; hovering it explains what sanitizing keeps and changes. */
export default function SanitizeInfoIcon({ slicerLabel }: { slicerLabel: string }) {
  const { t } = useTranslation(["models"]);
  return (
    <Tooltip title={t("models:detail.sanitizedInfo", { slicer: slicerLabel })} arrow describeChild>
      <LightbulbIcon fontSize="small" sx={{ color: "inherit" }} />
    </Tooltip>
  );
}
