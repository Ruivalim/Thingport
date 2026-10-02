import { useTranslation } from "react-i18next";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { type CategoriesView } from "../../api/settings";

type Props = {
  value: CategoriesView | null;
  onChange: (view: CategoriesView) => void;
};

/** Sits above the side box and matches its width. */
export default function CategoriesViewToggle({ value, onChange }: Props) {
  const { t } = useTranslation("models");
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: CategoriesView | null) => next && onChange(next)}
      aria-label={t("view.label") ?? undefined}
      sx={{ width: 260, flexShrink: 0, "& .MuiToggleButton-root": { flex: 1, gap: 0.75, textTransform: "none" } }}
    >
      <ToggleButton value="categories">
        <CategoryOutlinedIcon fontSize="small" />
        {t("view.categories")}
      </ToggleButton>
      <ToggleButton value="folders">
        <FolderOutlinedIcon fontSize="small" />
        {t("view.folders")}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
