import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Paper from "@mui/material/Paper";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Category, CategoryMetaInput } from "../../api/categories";
import { useConfirm } from "../../components/ConfirmProvider";
import CategoryMetaDialog from "./CategoryMetaDialog";

type Props = {
  categories: Category[];
  onClose: () => void;
  onCreate: (name: string, parentId: string | null) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (categoryIds: string[]) => Promise<void>;
  onMove: (id: string, parentId: string | null, position: number) => Promise<void>;
  onUpdateMeta: (id: string, meta: CategoryMetaInput) => Promise<void>;
};

function hasMeta(category: Category): boolean {
  return Boolean(
    category.meta_title ||
    category.meta_description ||
    category.makerworld_cat_ids ||
    category.thingiverse_cat_ids ||
    category.printables_cat_ids,
  );
}

/** Subcategory ids per top-level category id, in display order. */
type Containers = Record<string, string[]>;

type MoveButtons = { canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void };

/** What a sortable row needs from useSortable. */
type SortableBinding = { setNodeRef: (node: HTMLElement | null) => void; style: CSSProperties; handle: ReactNode };

function CategoryRow({
  name,
  indent,
  bold,
  busy,
  move,
  sortable,
  metaTitle,
  metaDescription,
  hasDetails,
  onOpenMeta,
  onRename,
  onDelete,
}: {
  name: string;
  indent: number;
  bold?: boolean;
  busy: boolean;
  /** Up/down arrows; top-level categories only. */
  move?: MoveButtons;
  /** Subcategories are dragged instead. */
  sortable?: SortableBinding;
  metaTitle: string | null;
  metaDescription: string | null;
  hasDetails: boolean;
  onOpenMeta: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => void;
}) {
  const { t } = useTranslation(["models", "common"]);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setValue(name);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setValue(name);
  };

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <ListItem ref={sortable?.setNodeRef} style={sortable?.style} disableGutters sx={{ pl: indent, py: 0.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: "100%" }}>
          <TextField
            size="small"
            fullWidth
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancelEdit();
            }}
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <IconButton size="small" onClick={commit} disabled={saving || !value.trim()}>
            {saving ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={cancelEdit} disabled={saving}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </ListItem>
    );
  }

  return (
    <ListItem
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      disableGutters
      sx={{ pl: indent, py: 0.5 }}
      secondaryAction={
        <Stack direction="row" spacing={0.25}>
          {move && (
            <>
              <IconButton
                size="small"
                onClick={move.onMoveUp}
                disabled={busy || !move.canMoveUp}
                aria-label={t("common:moveUp") ?? undefined}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={move.onMoveDown}
                disabled={busy || !move.canMoveDown}
                aria-label={t("common:moveDown") ?? undefined}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </>
          )}
          <Tooltip
            title={
              hasDetails ? (
                <Stack spacing={0.25} sx={{ py: 0.25 }}>
                  {metaTitle && (
                    <Typography variant="caption" fontWeight={700} sx={{ display: "block" }}>
                      {metaTitle}
                    </Typography>
                  )}
                  {metaDescription && (
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {metaDescription}
                    </Typography>
                  )}
                </Stack>
              ) : (
                (t("models:categories.manager.addDetailsTooltip") ?? "")
              )
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={onOpenMeta}
                disabled={busy}
                aria-label={
                  (hasDetails
                    ? t("models:categories.manager.editDetailsTooltip")
                    : t("models:categories.manager.addDetailsTooltip")) ?? undefined
                }
              >
                <InfoOutlinedIcon
                  fontSize="small"
                  sx={{
                    opacity: hasDetails ? 1 : 0.35,
                    color: hasDetails ? "primary.main" : "action.active",
                  }}
                />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton size="small" onClick={startEdit} disabled={busy} aria-label={t("common:rename") ?? undefined}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onDelete} disabled={busy} aria-label={t("common:delete") ?? undefined}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      {sortable?.handle}
      <Typography variant="body2" fontWeight={bold ? 600 : 400} noWrap sx={{ pr: move ? 19 : 12 }}>
        {name}
      </Typography>
    </ListItem>
  );
}

function DragHandle({
  setActivatorNodeRef,
  attributes,
  listeners,
}: Pick<ReturnType<typeof useSortable>, "setActivatorNodeRef" | "attributes" | "listeners">) {
  const { t } = useTranslation("models");
  return (
    <Box
      component="span"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={t("categories.manager.dragToMove") ?? undefined}
      sx={{
        display: "inline-flex",
        mr: 0.75,
        color: "action.active",
        cursor: "grab",
        touchAction: "none",
        borderRadius: 0.5,
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
      }}
    >
      <DragIndicatorIcon fontSize="small" />
    </Box>
  );
}

function SortableSubcategoryRow({
  id,
  ...rowProps
}: { id: string } & Omit<Parameters<typeof CategoryRow>[0], "sortable" | "move">) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <CategoryRow
      {...rowProps}
      sortable={{
        setNodeRef,
        // The DragOverlay shows the dragged row; this one stays as a faint placeholder.
        style: { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 },
        handle: <DragHandle setActivatorNodeRef={setActivatorNodeRef} attributes={attributes} listeners={listeners} />,
      }}
    />
  );
}

/** A drop target even when empty, so subcategories can be dragged into a category without any. */
function SubcategoryList({
  parentId,
  ids,
  dragging,
  children,
}: {
  parentId: string;
  ids: string[];
  dragging: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation("models");
  const { setNodeRef } = useDroppable({ id: parentId });
  return (
    <SortableContext id={parentId} items={ids} strategy={verticalListSortingStrategy}>
      <List ref={setNodeRef} disablePadding>
        {children}
        {dragging && ids.length === 0 && (
          <Box
            sx={{
              ml: 3,
              py: 0.75,
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 1,
              textAlign: "center",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {t("categories.manager.dropHere")}
            </Typography>
          </Box>
        )}
      </List>
    </SortableContext>
  );
}

function AddRow({
  indent,
  placeholder,
  busy,
  onAdd,
}: {
  indent: number;
  placeholder: string;
  busy: boolean;
  onAdd: (name: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setValue("");
    setAdding(false);
  };

  if (!adding) {
    return (
      <Button
        size="small"
        startIcon={<AddIcon fontSize="small" />}
        onClick={() => {
          setAdding(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        sx={{ ml: `${indent * 8}px` }}
      >
        {placeholder}
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pl: `${indent * 8}px`, py: 0.5 }}>
      <TextField
        inputRef={inputRef}
        size="small"
        fullWidth
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setAdding(false);
            setValue("");
          }
        }}
      />
      <IconButton size="small" onClick={submit} disabled={busy || !value.trim()}>
        {busy ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
      </IconButton>
      <IconButton
        size="small"
        onClick={() => {
          setAdding(false);
          setValue("");
        }}
        disabled={busy}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

export default function CategoryManagerModal({
  categories,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  onMove,
  onUpdateMeta,
}: Props) {
  const { t } = useTranslation(["models", "common"]);
  const confirmDialog = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [metaCategory, setMetaCategory] = useState<Category | null>(null);

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

  const untitledLabel = t("models:categories.untitled");

  const handleDeleteCategory = async (category: Category) => {
    const hasChildren = (childrenByParent[category.id] || []).length > 0;
    const message = hasChildren
      ? t("models:categories.manager.confirmDeleteCategoryWithSub", { name: category.name || untitledLabel })
      : t("models:categories.manager.confirmDeleteCategory", { name: category.name || untitledLabel });
    if (!(await confirmDialog({ message, destructive: true }))) return;
    setBusyId(category.id);
    try {
      await onDelete(category.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteSubcategory = async (category: Category) => {
    const message = t("models:categories.manager.confirmDeleteSubcategory", { name: category.name || untitledLabel });
    if (!(await confirmDialog({ message, destructive: true }))) return;
    setBusyId(category.id);
    try {
      await onDelete(category.id);
    } finally {
      setBusyId(null);
    }
  };

  const swapAndReorder = async (siblingIds: string[], index: number, direction: -1 | 1, busyKey: string) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= siblingIds.length) return;
    const reordered = siblingIds.slice();
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setBusyId(busyKey);
    try {
      await onReorder(reordered);
    } finally {
      setBusyId(null);
    }
  };

  const moveRoot = (index: number, direction: -1 | 1) =>
    swapAndReorder(
      roots.map((r) => r.id),
      index,
      direction,
      roots[index].id,
    );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const propContainers = useMemo<Containers>(
    () => Object.fromEntries(roots.map((root) => [root.id, (childrenByParent[root.id] || []).map((c) => c.id)])),
    [roots, childrenByParent],
  );
  // The order mid-drag and after a drop, until `categories` is refetched (which happens on failure too).
  const [optimistic, setOptimistic] = useState<{ base: Category[]; containers: Containers } | null>(null);
  const containers = optimistic?.base === categories ? optimistic.containers : propContainers;
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragOrigin = useRef<{ parentId: string; ids: string[] } | null>(null);

  const sensors = useSensors(
    // A few pixels of travel before dragging, so clicks on the handle don't start one.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Over ids are either a subcategory or a (possibly empty) top-level category's list. */
  const containerOf = (id: UniqueIdentifier): string | null => {
    const key = String(id);
    if (key in containers) return key;
    return Object.keys(containers).find((parentId) => containers[parentId].includes(key)) ?? null;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const parentId = containerOf(active.id);
    if (!parentId) return;
    setActiveId(String(active.id));
    dragOrigin.current = { parentId, ids: containers[parentId] };
    setOptimistic({ base: categories, containers });
  };

  // Crossing into another category moves the row there right away, so that list opens a gap for it.
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(active.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to) return;
    const id = String(active.id);
    const target = containers[to];
    const overIndex = target.indexOf(String(over.id));
    const insertAt = overIndex === -1 ? target.length : overIndex;
    setOptimistic({
      base: categories,
      containers: {
        ...containers,
        [from]: containers[from].filter((c) => c !== id),
        [to]: [...target.slice(0, insertAt), id, ...target.slice(insertAt)],
      },
    });
  };

  const resetDrag = () => {
    setActiveId(null);
    dragOrigin.current = null;
  };

  const handleDragCancel = () => {
    setOptimistic(null);
    resetDrag();
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const origin = dragOrigin.current;
    const to = over ? containerOf(over.id) : null;
    resetDrag();
    if (!origin || !to) {
      setOptimistic(null);
      return;
    }
    const id = String(active.id);
    const fromIndex = containers[to].indexOf(id);
    const overIndex = containers[to].indexOf(String(over!.id));
    const ids = overIndex === -1 ? containers[to] : arrayMove(containers[to], fromIndex, overIndex);
    setOptimistic({ base: categories, containers: { ...containers, [to]: ids } });

    setBusyId(id);
    try {
      if (to !== origin.parentId) {
        await onMove(id, to, ids.indexOf(id));
      } else if (ids.some((c, i) => c !== origin.ids[i])) {
        await onReorder(ids);
      } else {
        setOptimistic(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const activeCategory = activeId ? categoryById.get(activeId) : undefined;

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {t("models:categories.manager.title")}
          <IconButton size="small" onClick={onClose} aria-label={t("common:close") ?? undefined}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <List disablePadding>
              {roots.map((root, rootIndex) => {
                const childIds = containers[root.id] || [];
                return (
                  <Box key={root.id} sx={{ mb: 1.5 }}>
                    <CategoryRow
                      name={root.name || untitledLabel}
                      indent={0}
                      bold
                      busy={busyId === root.id}
                      move={{
                        canMoveUp: rootIndex > 0,
                        canMoveDown: rootIndex < roots.length - 1,
                        onMoveUp: () => moveRoot(rootIndex, -1),
                        onMoveDown: () => moveRoot(rootIndex, 1),
                      }}
                      metaTitle={root.meta_title}
                      metaDescription={root.meta_description}
                      hasDetails={hasMeta(root)}
                      onOpenMeta={() => setMetaCategory(root)}
                      onRename={(name) => onRename(root.id, name)}
                      onDelete={() => handleDeleteCategory(root)}
                    />
                    <SubcategoryList parentId={root.id} ids={childIds} dragging={activeId !== null}>
                      {childIds.map((childId) => {
                        const child = categoryById.get(childId);
                        if (!child) return null;
                        return (
                          <SortableSubcategoryRow
                            key={child.id}
                            id={child.id}
                            name={child.name || untitledLabel}
                            indent={3}
                            busy={busyId === child.id}
                            metaTitle={child.meta_title}
                            metaDescription={child.meta_description}
                            hasDetails={hasMeta(child)}
                            onOpenMeta={() => setMetaCategory(child)}
                            onRename={(name) => onRename(child.id, name)}
                            onDelete={() => handleDeleteSubcategory(child)}
                          />
                        );
                      })}
                    </SubcategoryList>
                    <Box sx={{ pl: 0.5 }}>
                      <AddRow
                        indent={3}
                        placeholder={t("models:categories.manager.addSubcategory")}
                        busy={busyId === `new-sub-${root.id}`}
                        onAdd={async (name) => {
                          setBusyId(`new-sub-${root.id}`);
                          try {
                            await onCreate(name, root.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}

              {!roots.length && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  {t("models:categories.manager.noCategories")}
                </Typography>
              )}
            </List>
            <DragOverlay>
              {activeCategory && (
                <Paper
                  elevation={6}
                  sx={{ display: "flex", alignItems: "center", px: 1, py: 0.75, cursor: "grabbing" }}
                >
                  <DragIndicatorIcon fontSize="small" sx={{ mr: 0.75, color: "action.active" }} />
                  <Typography variant="body2" noWrap>
                    {activeCategory.name || untitledLabel}
                  </Typography>
                </Paper>
              )}
            </DragOverlay>
          </DndContext>

          <Divider sx={{ my: 1.5 }} />

          <AddRow
            indent={0}
            placeholder={t("models:categories.manager.addCategory")}
            busy={busyId === "new-root"}
            onAdd={async (name) => {
              setBusyId("new-root");
              try {
                await onCreate(name, null);
              } finally {
                setBusyId(null);
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t("common:close")}</Button>
        </DialogActions>
      </Dialog>
      {metaCategory && (
        <CategoryMetaDialog
          category={metaCategory}
          onClose={() => setMetaCategory(null)}
          onSave={(meta) => onUpdateMeta(metaCategory.id, meta)}
        />
      )}
    </>
  );
}
