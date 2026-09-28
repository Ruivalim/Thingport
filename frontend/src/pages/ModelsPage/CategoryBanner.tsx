import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { type Category } from "../../api/categories";
import { translateCategoryDisplay } from "../../utils/translateCategoryDisplay";

type Props = {
  category: Category;
};

/** Shown above the grid when the category has meta text. Nothing without a title. */
export default function CategoryBanner({ category }: Props) {
  const { i18n } = useTranslation();
  const display = translateCategoryDisplay(category, i18n);
  if (!display.metaTitle) return null;
  return (
    <Box
      sx={{
        borderRadius: 2,
        px: 2.5,
        py: 2,
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "linear-gradient(45deg, #5061ff 0%, #31ceff 100%)"
            : alpha(theme.palette.primary.main, 0.08),
      }}
    >
      <Typography variant="h6" sx={{ color: (theme) => (theme.palette.mode === "dark" ? "#fff" : undefined) }}>
        {display.metaTitle}
      </Typography>
      {display.metaDescription && (
        <Typography
          variant="body2"
          sx={{ mt: 0.5, color: (theme) => (theme.palette.mode === "dark" ? "#fff" : "text.secondary") }}
        >
          {display.metaDescription}
        </Typography>
      )}
    </Box>
  );
}
