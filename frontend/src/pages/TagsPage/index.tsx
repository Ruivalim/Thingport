import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import { UnauthorizedError } from "../../api/client";
import { type TagSortMode, type TagSummary, tagsApi } from "../../api/tags";
import TagSortTabs from "./TagSortTabs";
import TagTile, { TagTileSkeletons } from "./TagTile";
import VirtualTagGrid from "./VirtualTagGrid";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";

type Props = {
  onUnauthorized?: () => void;
  onBookmarksChanged?: () => void;
};

/** Enough tags to fill the screen about one and a half times, so a big one is filled by its first request. */
function pageSizeForScreen(): number {
  const tile = 172; // a 160px tile and its gap
  const columns = Math.max(2, Math.floor(window.innerWidth / tile));
  const rows = Math.ceil(window.innerHeight / tile);
  return Math.min(100, Math.max(30, Math.ceil(columns * rows * 1.5)));
}

const TILE_GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, calc(50% - 6px)), 1fr))",
  gap: 1.5,
} as const;

/** Every tag as a square of its models' pictures, with its count and a bookmark toggle. Rarely-used tags
 *  (under 2 models) are hidden by default. */
export default function TagsPage({ onUnauthorized, onBookmarksChanged }: Props) {
  const { t } = useTranslation(["models", "common"]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [anyTags, setAnyTags] = useState(false);
  const [sortMode, setSortMode] = useState<TagSortMode>("popular");
  const [hideRarelyUsed, setHideRarelyUsed] = useState(true);
  const minCount = hideRarelyUsed ? 2 : 1;
  const [pageSize] = useState(pageSizeForScreen);
  // Bumped whenever the sort or filter changes, so a page still on its way for the old one is dropped.
  const generation = useRef(0);

  const handleError = (err: unknown, message?: string) => {
    if (err instanceof UnauthorizedError) {
      onUnauthorized?.();
      return true;
    }
    console.error(err);
    if (message) alert(message);
    return false;
  };

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setTags([]);
    (async () => {
      try {
        const page = await tagsApi.listSummary({ sort: sortMode, limit: pageSize, offset: 0, minCount });
        if (current !== generation.current) return;
        setTags(page.items);
        setHasMore(page.has_more);
        setAnyTags(page.total_all > 0);
      } catch (err) {
        if (current === generation.current) handleError(err, t("models:errors.loadFailed"));
      } finally {
        if (current === generation.current) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode, minCount, pageSize]);

  const loadMore = useCallback(async () => {
    const current = generation.current;
    setLoadingMore(true);
    try {
      const page = await tagsApi.listSummary({ sort: sortMode, limit: pageSize, offset: tags.length, minCount });
      if (current !== generation.current) return;
      setTags((prev) => [...prev, ...page.items]);
      setHasMore(page.has_more);
    } catch (err) {
      if (current === generation.current) handleError(err, t("models:errors.loadFailed"));
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode, minCount, pageSize, tags.length]);

  const sentinelRef = useInfiniteScroll(() => void loadMore(), hasMore, loading || loadingMore);

  // A ref, not state: the callbacks below stay the same between renders, so the memoized tiles don't redraw.
  const pendingTag = useRef<string | null>(null);
  const toggleBookmark = useCallback(async (tag: TagSummary) => {
    if (pendingTag.current) return;
    pendingTag.current = tag.name;
    const nextBookmarked = !tag.bookmarked;
    setTags((prev) => prev.map((t2) => (t2.name === tag.name ? { ...t2, bookmarked: nextBookmarked } : t2)));
    try {
      await (nextBookmarked ? tagsApi.bookmark(tag.name) : tagsApi.unbookmark(tag.name));
      onBookmarksChanged?.();
    } catch (err) {
      setTags((prev) => prev.map((t2) => (t2.name === tag.name ? { ...t2, bookmarked: tag.bookmarked } : t2)));
      if (err instanceof UnauthorizedError) {
        onUnauthorized?.();
        return;
      }
      console.error(err);
      alert(t("models:tags.bookmarkFailed"));
    } finally {
      pendingTag.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeTag = useCallback(
    (tag: TagSummary) => {
      setTags((prev) => prev.filter((other) => other.name !== tag.name));
      if (tag.bookmarked) onBookmarksChanged?.();
    },
    [onBookmarksChanged],
  );
  const onToggleBookmark = useCallback((tag: TagSummary) => void toggleBookmark(tag), [toggleBookmark]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <FormControlLabel
          control={
            <Switch size="small" checked={hideRarelyUsed} onChange={(e) => setHideRarelyUsed(e.target.checked)} />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              {t("models:tags.hideRarelyUsed")}
            </Typography>
          }
        />
        <TagSortTabs value={sortMode} onChange={setSortMode} />
      </Stack>

      {loading ? (
        <Box sx={TILE_GRID}>
          <TagTileSkeletons count={12} />
        </Box>
      ) : tags.length ? (
        <>
          <VirtualTagGrid
            tags={tags}
            skeletons={loadingMore ? 6 : 0}
            renderTile={(tag) => (
              <TagTile
                key={tag.name}
                tag={tag}
                onToggleBookmark={onToggleBookmark}
                onUnauthorized={onUnauthorized}
                onDeleted={removeTag}
              />
            )}
          />
          {hasMore && <Box ref={sentinelRef} sx={{ height: 1 }} />}
        </>
      ) : (
        <Stack alignItems="center" spacing={1} sx={{ py: 8, color: "text.secondary" }}>
          <Typography variant="body2">{anyTags ? t("models:tags.allHidden") : t("models:tags.empty")}</Typography>
        </Stack>
      )}
    </Stack>
  );
}
