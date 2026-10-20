import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Print } from "../api/prints";

export type ModelSelection = {
  /** Select mode: clicking a card selects it instead of opening it. */
  active: boolean;
  setActive: (active: boolean) => void;
  selected: Print[];
  isSelected: (id: string) => boolean;
  /** `range` (a shift-click) also takes every card between this one and the last one clicked. */
  toggle: (id: string, range?: boolean) => void;
  selectAll: () => void;
  clear: () => void;
};

/** Multi-select over a grid's loaded models. Ids that leave the grid (deleted, filtered out) drop out of it. */
export function useModelSelection(items: Print[]): ModelSelection {
  const [active, setActiveState] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const present = new Set(items.map((item) => item.id));
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);

  const setActive = useCallback(
    (next: boolean) => {
      setActiveState(next);
      if (!next) clear();
    },
    [clear],
  );

  const toggle = useCallback(
    (id: string, range = false) => {
      const anchor = anchorRef.current;
      anchorRef.current = id;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const from = anchor ? items.findIndex((item) => item.id === anchor) : -1;
        const to = items.findIndex((item) => item.id === id);
        if (range && from >= 0 && to >= 0) {
          // The range takes the state the anchor was left in, as a file manager does.
          const select = prev.has(anchor!);
          for (const item of items.slice(Math.min(from, to), Math.max(from, to) + 1)) {
            if (select) next.add(item.id);
            else next.delete(item.id);
          }
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [items],
  );

  const selectAll = useCallback(() => setSelectedIds(new Set(items.map((item) => item.id))), [items]);

  // Escape leaves select mode, unless it's closing a dialog or menu opened from it.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest(".MuiModal-root, .MuiPopover-root")) return;
      setActive(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, setActive]);

  const selected = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return { active, setActive, selected, isSelected, toggle, selectAll, clear };
}

/** `items` with each of `updated` put in place of the model it updates. */
export function replacePrints(items: Print[], updated: Print[]): Print[] {
  const byId = new Map(updated.map((print) => [print.id, print]));
  return items.map((item) => byId.get(item.id) ?? item);
}
