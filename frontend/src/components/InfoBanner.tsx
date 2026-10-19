import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

type Props = {
  title?: string | null;
  description?: string | null;
};

/** The tinted box above a model grid that says what the grid is: a category's or a collection's description. Nothing
 *  when there's neither a title nor a description. */
export default function InfoBanner({ title, description }: Props) {
  if (!title && !description) return null;
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
      {title && (
        <Typography variant="h6" sx={{ color: (theme) => (theme.palette.mode === "dark" ? "#fff" : undefined) }}>
          {title}
        </Typography>
      )}
      {description && (
        <Typography
          variant="body2"
          sx={{
            mt: title ? 0.5 : 0,
            whiteSpace: "pre-line",
            color: (theme) => (theme.palette.mode === "dark" ? "#fff" : "text.secondary"),
          }}
        >
          {description}
        </Typography>
      )}
    </Box>
  );
}
