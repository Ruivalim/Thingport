import { useTranslation } from "react-i18next";
import Tooltip from "@mui/material/Tooltip";
import LightbulbIcon from "@mui/icons-material/Lightbulb";

/** The "Open normalized in <slicer>" icon; hovering it explains what normalizing keeps and changes. */
export default function NormalizeInfoIcon({ slicerLabel }: { slicerLabel: string }) {
  const { t } = useTranslation(["models"]);
  return (
    <Tooltip title={t("models:detail.normalizedInfo", { slicer: slicerLabel })} arrow describeChild>
      <LightbulbIcon fontSize="small" sx={{ color: "inherit" }} />
    </Tooltip>
  );
}
