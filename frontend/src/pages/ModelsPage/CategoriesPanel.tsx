import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Theme } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import SettingsIcon from "@mui/icons-material/Settings";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { Category, CategoryMetaInput } from "../../api/categories";
import { translateCategoryDisplay } from "../../utils/translateCategoryDisplay";
import { dividerBorderColor } from "../../theme";
import CategoryManagerModal from "./CategoryManagerModal";

type Props = {
  categories: Category[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string, parentId: string | null) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (categoryIds: string[]) => Promise<void>;
  onUpdateMeta: (id: string, meta: CategoryMetaInput) => Promise<void>;
};

function rowSx(active: boolean) {
  return {
    borderRadius: 1.5,
    mb: 0.25,
    background: (theme: Theme) => (active ? theme.thingport.selectedNavBackground : "transparent"),
    ...(active
      ? { "&:hover": { background: (theme: Theme) => theme.thingport.selectedNavBackground } }
      : {
          // Dark mode: brighten the label instead of tinting the background on hover.
          "&:hover": (theme: Theme) =>
            theme.palette.mode === "dark"
              ? { backgroundColor: "transparent", "& .MuiListItemText-primary, & .MuiSvgIcon-root": { color: "#fff" } }
              : { bgcolor: "action.hover" },
        }),
  };
}
function rowTextSx(active: boolean, extra?: object) {
  return {
    noWrap: true,
    variant: "body2" as const,
    sx: {
      color: (theme: Theme) => (active ? theme.thingport.selectedNavText : theme.thingport.navInactiveText),
      ...extra,
    },
  };
}

/** A two-level tree: a root selects all its subcategories' models; one root is expanded at a time. */
export default function CategoriesPanel({
  categories,
  loading,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  onUpdateMeta,
}: Props) {
  const { t, i18n } = useTranslation(["models", "common"]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const displayName = (category: Category) => translateCategoryDisplay(category, i18n).name;

  const untitledLabel = t("models:categories.untitled");

  // Expand the selected child's root when the selection comes from outside (URL, back/forward), or
  // the child never renders.
  useEffect(() => {
    if (!selectedId) return;
    const selected = categories.find((c) => c.id === selectedId);
    if (!selected) return;
    setExpandedId(selected.parent_id || selected.id);
  }, [selectedId, categories]);

  const { roots, childrenByParent } = useMemo(() => {
    const childrenMap: Record<string, Category[]> = {};
    const rootList: Category[] = [];
    categories.forEach((f) => {
      if (f.parent_id) {
        if (!childrenMap[f.parent_id]) childrenMap[f.parent_id] = [];
        childrenMap[f.parent_id].push(f);
      } else {
        rootList.push(f);
      }
    });
    const byPosition = (a: Category, b: Category) => a.position - b.position || a.name.localeCompare(b.name);
    Object.keys(childrenMap).forEach((key) => {
      childrenMap[key] = childrenMap[key].toSorted(byPosition);
    });
    return {
      roots: rootList.toSorted(byPosition),
      childrenByParent: childrenMap,
    };
  }, [categories]);

  const handleRootClick = (id: string) => {
    setExpandedId(id);
    onSelect(id);
  };

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          width: 260,
          flexShrink: 0,
          borderRadius: "12px",
          p: 1.5,
          alignSelf: "flex-start",
          bgcolor: "background.paper",
          borderColor: dividerBorderColor,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t("models:categories.title")}
          </Typography>
          <Tooltip title={t("models:categories.manageTooltip") ?? ""}>
            <IconButton
              size="small"
              onClick={() => setManagerOpen(true)}
              aria-label={t("models:categories.manageTooltip") ?? undefined}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <List disablePadding>
          <ListItemButton onClick={() => onSelect(null)} sx={rowSx(selectedId === null)}>
            <ListItemText
              primary={t("models:categories.all")}
              primaryTypographyProps={rowTextSx(selectedId === null, { fontWeight: 600 })}
            />
          </ListItemButton>

          {loading && (
            <Stack alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size={18} />
            </Stack>
          )}

          {!loading &&
            roots.map((root) => {
              const children = childrenByParent[root.id] || [];
              const isOpen = expandedId === root.id;
              const isRootActive = isOpen && selectedId === root.id;
              return (
                <Stack key={root.id}>
                  <ListItemButton onClick={() => handleRootClick(root.id)} sx={rowSx(isRootActive)}>
                    <ListItemText
                      primary={displayName(root) || untitledLabel}
                      primaryTypographyProps={rowTextSx(isRootActive, { fontWeight: 600 })}
                    />
                    <ChevronRightIcon
                      fontSize="small"
                      sx={{
                        ml: 0.5,
                        flexShrink: 0,
                        transform: isOpen ? "rotate(90deg)" : "none",
                        transition: "transform 0.15s",
                        color: (theme) =>
                          isRootActive ? theme.thingport.selectedNavText : theme.thingport.navInactiveText,
                      }}
                    />
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {children.map((child) => {
                        const isChildSelected = selectedId === child.id;
                        return (
                          <ListItemButton
                            key={child.id}
                            onClick={() => onSelect(child.id)}
                            sx={{ pl: 4, ...rowSx(isChildSelected) }}
                          >
                            <ListItemText
                              primary={displayName(child) || untitledLabel}
                              primaryTypographyProps={rowTextSx(
                                isChildSelected,
                                isChildSelected ? { fontWeight: 700 } : undefined,
                              )}
                            />
                          </ListItemButton>
                        );
                      })}
                      {!children.length && (
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 4, display: "block", py: 0.5 }}>
                          {t("models:categories.noSubcategories")}
                        </Typography>
                      )}
                    </List>
                  </Collapse>
                </Stack>
              );
            })}

          {!loading && !roots.length && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
              {t("models:categories.empty")}
            </Typography>
          )}
        </List>
      </Paper>

      {managerOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setManagerOpen(false)}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          onReorder={onReorder}
          onUpdateMeta={onUpdateMeta}
        />
      )}
    </>
  );
}
