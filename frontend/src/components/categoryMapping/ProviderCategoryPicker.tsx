import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import { ProviderLogo, type ProviderId } from "../Layout/ConfigurationDialog/providerLogos";
import { SectionLabel } from "../Layout/ConfigurationDialog/parts";
import { indexCatalog, loadProviderCatalog, type CatalogCategory } from "./providerCatalog";

type Props = {
  provider: ProviderId;
  providerName: string;
  /** The Thingport category being mapped, for the title. */
  categoryName: string;
  selected: string[];
  onClose: () => void;
  onDone: (ids: string[]) => void;
};

const appear = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: none; }
`;

const chipMotion = {
  transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
  "@media (prefers-reduced-motion: reduce)": { transition: "none", animation: "none" },
} as const;

/** A provider's categories as chips to pick, grouped under their top-level ones, with search. Picks are kept here
 *  until Done; ids the catalog doesn't know (a category the site has since dropped) stay picked, shown by id. */
export default function ProviderCategoryPicker({
  provider,
  providerName,
  categoryName,
  selected: initial,
  onClose,
  onDone,
}: Props) {
  const { t } = useTranslation(["models", "common"]);
  const [index, setIndex] = useState<Map<string, CatalogCategory> | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    loadProviderCatalog()
      .then((catalog) => active && setIndex(indexCatalog(catalog[provider] ?? [])))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [provider]);

  const picked = new Set(selected);
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  // Top-level categories in the site's order, each with everything under it that matches the search. A top-level
  // one that matches brings all of its own.
  const groups = useMemo(() => {
    if (!index) return [];
    const needle = query.trim().toLowerCase();
    const matches = (category: CatalogCategory) => category.path.join(" ").toLowerCase().includes(needle);
    const all = [...index.values()];
    return all
      .filter((category) => category.id === category.root)
      .flatMap((root) => {
        const children = all.filter((category) => category.root === root.id && category.id !== root.id);
        const shown = !needle || matches(root) ? children : children.filter(matches);
        return !needle || matches(root) || shown.length ? [{ root, children: shown }] : [];
      });
  }, [index, query]);

  const labelOf = (id: string) => {
    const category = index?.get(id);
    return category ? category.name : t("categories.manager.mapping.unknown", { id });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <ProviderLogo id={provider} size={22} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {t("categories.manager.mapping.pickerTitle", { provider: providerName })}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" noWrap>
              {t("categories.manager.mapping.pickerSubtitle", { provider: providerName, category: categoryName })}
            </Typography>
          </Box>
        </Stack>
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("categories.manager.mapping.search", { provider: providerName }) ?? undefined}
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          sx={{ mt: 1.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { "aria-label": t("categories.manager.mapping.search", { provider: providerName }) },
          }}
        />
      </DialogTitle>
      <DialogContent dividers>
        {selected.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <SectionLabel>{t("categories.manager.mapping.selected", { count: selected.length })}</SectionLabel>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {selected.map((id) => (
                <Chip
                  key={id}
                  size="small"
                  color="primary"
                  label={labelOf(id)}
                  title={index?.get(id)?.path.join(" › ")}
                  onDelete={() => toggle(id)}
                  sx={{ ...chipMotion, animation: `${appear} 150ms ease` }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {failed ? (
          <Typography variant="body2" color="error">
            {t("categories.manager.mapping.loadFailed")}
          </Typography>
        ) : !index ? (
          <Stack spacing={2} aria-busy="true">
            {[0, 1, 2].map((row) => (
              <Box key={row}>
                <Skeleton variant="text" width="30%" />
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {[64, 88, 72, 96, 56].map((width) => (
                    <Skeleton key={width} variant="rounded" width={width} height={24} sx={{ borderRadius: 4 }} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            {query.trim()
              ? t("categories.manager.mapping.noMatches", { query: query.trim() })
              : t("categories.manager.mapping.empty", { provider: providerName })}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {groups.map(({ root, children }) => (
              <Box key={root.id}>
                <CategoryChip label={root.name} selected={picked.has(root.id)} onClick={() => toggle(root.id)} strong />
                {children.length > 0 && (
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    gap={0.75}
                    sx={{ mt: 0.75, pl: 1.5, borderLeft: 2, borderColor: "divider" }}
                  >
                    {children.map((category) => (
                      <CategoryChip
                        key={category.id}
                        label={category.name}
                        // Deeper ones say what they sit under.
                        title={category.path.length > 2 ? category.path.slice(1).join(" › ") : undefined}
                        selected={picked.has(category.id)}
                        onClick={() => toggle(category.id)}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelected([])} disabled={!selected.length} sx={{ mr: "auto" }}>
          {t("categories.manager.mapping.clearAll")}
        </Button>
        <Button onClick={onClose}>{t("common:cancel")}</Button>
        <Button variant="contained" onClick={() => onDone(selected)}>
          {t("categories.manager.mapping.done")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CategoryChip({
  label,
  title,
  selected,
  onClick,
  strong = false,
}: {
  label: string;
  title?: string;
  selected: boolean;
  onClick: () => void;
  strong?: boolean;
}) {
  return (
    <Chip
      size="small"
      label={label}
      title={title}
      clickable
      onClick={onClick}
      aria-pressed={selected}
      color={selected ? "primary" : "default"}
      variant={selected ? "filled" : "outlined"}
      icon={selected ? <CheckIcon /> : undefined}
      sx={{ ...chipMotion, ...(strong && { fontWeight: 700 }) }}
    />
  );
}
