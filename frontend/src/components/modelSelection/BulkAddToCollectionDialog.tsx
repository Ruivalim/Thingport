import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import { UnauthorizedError } from "../../api/client";
import { type Collection, collectionsApi } from "../../api/collections";

type Props = {
  open: boolean;
  onClose: () => void;
  printIds: string[];
  onUnauthorized?: () => void;
};

/** Each chip adds every selected model to that collection at once. Unlike the one-model dialog it doesn't remove:
 *  the selection may be only partly in a collection, so there's no single state to toggle back to. */
export default function BulkAddToCollectionDialog({ open, onClose, printIds, onUnauthorized }: Props) {
  const { t } = useTranslation(["models", "common"]);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCollections(null);
    setAddedIds(new Set());
    collectionsApi
      .list()
      .then((all) => setCollections(all.filter((c) => !c.system_key)))
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          onUnauthorized?.();
          return;
        }
        setError(err instanceof Error ? err.message : t("models:detail.addToCollectionLoadFailed"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = async (collection: Collection) => {
    if (pendingId) return;
    setPendingId(collection.id);
    setError(null);
    try {
      await collectionsApi.addItems(collection.id, printIds);
      setAddedIds((prev) => new Set(prev).add(collection.id));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
        return;
      }
      console.error(err);
      setError(err instanceof Error ? err.message : t("models:detail.addToCollectionFailed"));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("models:selection.addToCollectionTitle", { count: printIds.length })}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        {collections === null && !error && (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {[72, 96, 64, 88].map((width) => (
              <Skeleton key={width} variant="rounded" width={width} height={32} sx={{ borderRadius: 4 }} />
            ))}
          </Stack>
        )}
        {collections?.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("models:detail.addToCollectionEmpty")}
          </Typography>
        )}
        {collections && collections.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {collections.map((c) => {
              const added = addedIds.has(c.id);
              return (
                <Chip
                  key={c.id}
                  label={c.name}
                  clickable={!added}
                  disabled={pendingId === c.id}
                  onClick={added ? undefined : () => void add(c)}
                  color={added ? "primary" : "default"}
                  variant={added ? "filled" : "outlined"}
                  aria-pressed={added}
                  icon={
                    pendingId === c.id ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : added ? (
                      <CheckIcon fontSize="small" />
                    ) : undefined
                  }
                />
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common:close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
