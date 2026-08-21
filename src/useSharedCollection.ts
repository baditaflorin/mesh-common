import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

/** The minimum shape needed for stable collaborative collection operations. */
export type SharedCollectionItem = { id: string };

export type SharedCollection<T extends SharedCollectionItem> = {
  /** Items in their shared display order. */
  items: T[];
  /** Add an item. Returns false when its id is invalid, already present, or rejected by `validate`. */
  add: (item: T) => boolean;
  /** Merge a patch into an item without allowing its stable id to change. */
  update: (id: string, patch: Partial<Omit<T, "id">>) => boolean;
  /** Remove an item by id. */
  remove: (id: string) => boolean;
  /** Move an item to a zero-based position (clamped to the collection bounds). */
  move: (id: string, toIndex: number) => boolean;
  /** Remove every item. */
  clear: () => void;
  /** Look up one item by its stable id. */
  byId: (id: string) => T | undefined;
};

export type SharedCollectionOptions<T extends SharedCollectionItem> = {
  /** Reject malformed app-specific items before they enter the shared document. */
  validate?: (item: T) => boolean;
};

/**
 * An ordered, id-addressable CRDT collection backed by `Y.Array<T>`.
 *
 * Use this for shared lists where an item has an app-owned stable `id`: tasks,
 * shopping items, decisions, prompts, and wish-list entries. Unlike an
 * append-only event log, entries may be safely updated, removed and reordered.
 * The optional validator is the boundary for untrusted app input; existing
 * values from old peers remain readable rather than being destructively pruned.
 */
export function useSharedCollection<T extends SharedCollectionItem>(
  room: YRoom | null,
  key: string,
  opts?: SharedCollectionOptions<T>,
): SharedCollection<T> {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const array = room.doc.getArray<T>(key);
    const onChange = () => rerender((version) => version + 1);
    array.observe(onChange);
    return () => array.unobserve(onChange);
  }, [room, key]);

  const array = room ? room.doc.getArray<T>(key) : null;
  const items = array ? array.toArray() : [];

  // Read the CRDT for operations rather than relying on the last render: apps
  // commonly add several items in a single event handler / React `act` block.
  const currentItems = () => (array ? array.toArray() : []);
  const indexOf = (id: string) => currentItems().findIndex((item) => item?.id === id);

  return {
    items,
    add: (item) => {
      if (!array || !item || typeof item.id !== "string" || item.id.trim() === "") {
        return false;
      }
      if (indexOf(item.id) !== -1 || opts?.validate?.(item) === false) return false;
      // Store a shallow copy so a caller cannot mutate the value after it was published.
      array.push([{ ...item }]);
      return true;
    },
    update: (id, patch) => {
      if (!array || !id) return false;
      const index = indexOf(id);
      const existing = index < 0 ? undefined : currentItems()[index];
      if (!existing) return false;
      // An id identifies the same logical CRDT entry for its whole lifetime.
      const next = { ...existing, ...patch, id } as T;
      if (opts?.validate?.(next) === false) return false;
      room!.doc.transact(() => {
        array.delete(index, 1);
        array.insert(index, [next]);
      });
      return true;
    },
    remove: (id) => {
      if (!array || !id) return false;
      const index = indexOf(id);
      if (index < 0) return false;
      array.delete(index, 1);
      return true;
    },
    move: (id, toIndex) => {
      if (!array || !Number.isFinite(toIndex)) return false;
      const fromIndex = indexOf(id);
      if (fromIndex < 0) return false;
      const current = currentItems();
      const target = Math.max(0, Math.min(current.length - 1, Math.trunc(toIndex)));
      if (target === fromIndex) return false;
      const item = current[fromIndex];
      if (!item) return false;
      room!.doc.transact(() => {
        array.delete(fromIndex, 1);
        array.insert(target, [item]);
      });
      return true;
    },
    clear: () => {
      if (array && array.length > 0) array.delete(0, array.length);
    },
    byId: (id) => (id ? items.find((item) => item?.id === id) : undefined),
  };
}
