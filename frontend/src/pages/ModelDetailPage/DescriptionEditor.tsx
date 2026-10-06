import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MarkdownDescription from "../../components/MarkdownDescription";
import { dividerBorderColor } from "../../theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/** The description field: Markdown source, with a tab to preview it as the detail page shows it. */
export default function DescriptionEditor({ value, onChange, disabled }: Props) {
  const { t } = useTranslation("models");
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary">
          {t("detail.description")}
        </Typography>
        <Tabs value={tab} onChange={(_e, next) => setTab(next)} sx={{ minHeight: 32 }}>
          <Tab value="write" label={t("edit.descriptionWrite")} sx={{ minHeight: 32, py: 0.5 }} />
          <Tab value="preview" label={t("edit.descriptionPreview")} sx={{ minHeight: 32, py: 0.5 }} />
        </Tabs>
      </Box>
      {tab === "write" ? (
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          fullWidth
          multiline
          minRows={6}
          maxRows={20}
          placeholder={t("edit.descriptionPlaceholder")}
          helperText={t("edit.descriptionMarkdownHint")}
          inputProps={{ "aria-label": t("detail.description") }}
          sx={{ mt: 1, "& textarea": { fontFamily: "monospace", fontSize: "0.85rem" } }}
        />
      ) : (
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            minHeight: 140,
            maxHeight: 480,
            overflowY: "auto",
            border: "1px solid",
            borderColor: dividerBorderColor,
            borderRadius: "4px",
          }}
        >
          {value.trim() ? (
            <MarkdownDescription markdown={value} />
          ) : (
            <Typography variant="body2" color="text.disabled">
              {t("detail.noDescription")}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
