import React from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";

export type DialogSection<T extends string> = { id: T; label: string; icon: React.ReactNode };

const selectedBg = (theme: Theme) =>
  theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
const hoverBg = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)");

// "large" fits wider section names on one line and longer content, e.g. tree editors and lists.
const SIZES = {
  default: { width: 620, height: 520, navWidth: 170 },
  large: { width: 920, height: 680, navWidth: 210 },
};

type Props<T extends string> = {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: DialogSection<T>[];
  section: T;
  onSectionChange: (section: T) => void;
  size?: keyof typeof SIZES;
  children: React.ReactNode;
};

/** Settings by section, like the app's Configuration: the sections on the left (tabs along the top
 *  on phones), the chosen one on the right. */
export default function SectionedDialog<T extends string>({
  open,
  onClose,
  title,
  sections,
  section,
  onSectionChange,
  size = "default",
  children,
}: Props<T>) {
  const { t } = useTranslation("common");
  const { width, height, navWidth } = SIZES[size];

  const sectionButton = ({ id, label, icon }: DialogSection<T>, compact: boolean) => {
    const chosen = id === section;
    return (
      <ButtonBase
        key={id}
        aria-pressed={chosen}
        onClick={() => onSectionChange(id)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: compact ? "center" : "flex-start",
          gap: 1.25,
          flex: compact ? 1 : undefined,
          width: compact ? undefined : "100%",
          px: 1.5,
          py: compact ? 1.25 : 1,
          borderRadius: "8px",
          fontSize: "0.8rem",
          fontWeight: 500,
          // Phone tabs share the width, so only the side menu keeps labels on one line.
          whiteSpace: compact ? "normal" : "nowrap",
          color: chosen ? (muiTheme) => muiTheme.thingport.headingText : "text.secondary",
          bgcolor: chosen ? selectedBg : "transparent",
          transition: "background-color 150ms",
          "&:hover": { bgcolor: chosen ? selectedBg : hoverBg },
        }}
      >
        {!compact && icon}
        {label}
      </ButtonBase>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width,
            maxWidth: "calc(100% - 32px)",
            height: { xs: "75vh", md: height },
            maxHeight: "calc(100% - 32px)",
            m: 2,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          component="h2"
          sx={{ color: (muiTheme) => muiTheme.thingport.headingText }}
        >
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label={t("close") ?? undefined}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Phones: the sections as tabs along the top. */}
      <Box
        sx={{
          display: { xs: "flex", md: "none" },
          flexShrink: 0,
          gap: 0.5,
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {sections.map((s) => sectionButton(s, true))}
      </Box>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box
          component="nav"
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            gap: 0.25,
            width: navWidth,
            flexShrink: 0,
            p: 1.25,
            borderRight: 1,
            borderColor: "divider",
          }}
        >
          {sections.map((s) => sectionButton(s, false))}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", px: { xs: 2, md: 2.5 }, pt: 1.75, pb: 2.5 }}>
          {children}
        </Box>
      </Box>
    </Dialog>
  );
}
