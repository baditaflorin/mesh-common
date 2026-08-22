import { useCallback } from "react";
import type { YRoom } from "./useYRoom";
import { useSharedCollection } from "./useSharedCollection";

export type SharedChecklistItem = {
  /** Stable item identity. Supply one when importing deterministic tasks. */
  id: string;
  /** Human-readable task text, trimmed before it is replicated. */
  text: string;
  completed: boolean;
  createdBy: string;
  createdAt: number;
  completedBy: string | null;
  completedAt: number | null;
};

export type SharedChecklistOptions = {
  /** Maximum number of items permitted in this list. Default: 200. */
  maxItems?: number;
  /** Maximum characters in an item label. Default: 280. */
  maxTextLength?: number;
  /** Time source, usually `clock.meshNow`, for testable/shared timestamps. */
  now?: () => number;
};

export type SharedChecklist = {
  items: SharedChecklistItem[];
  openCount: number;
  completedCount: number;
  /** Add a validated task, or return null when unavailable/invalid/full. */
  add: (text: string, options?: { id?: string }) => SharedChecklistItem | null;
  /** Mark one task complete or reopen it. Returns false when it does not exist. */
  setCompleted: (id: string, completed: boolean) => boolean;
  /** Toggle one task's completion state. */
  toggle: (id: string) => boolean;
  /** Remove a task. */
  remove: (id: string) => boolean;
  /** Remove all tasks (use only for an explicit reset UI). */
  clear: () => void;
};

function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `check-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A small, validated shared task list built on `useSharedCollection`.
 *
 * Completion is an attributed shared write rather than a local checkbox, so
 * every peer sees the same state. The hook only accepts bounded plain text;
 * render it as text, never as HTML. It does not prescribe task assignment or
 * moderation, which are app-specific policies.
 */
export function useSharedChecklist(
  room: YRoom | null,
  key: string,
  options: SharedChecklistOptions = {},
): SharedChecklist {
  const maxItems = Math.max(1, Math.floor(options.maxItems ?? 200));
  const maxTextLength = Math.max(1, Math.floor(options.maxTextLength ?? 280));
  const now = options.now ?? Date.now;
  const collection = useSharedCollection<SharedChecklistItem>(
    room,
    `checklist:${key}`,
    {
      validate: (item) =>
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        item.text.trim().length > 0 &&
        item.text.length <= maxTextLength &&
        typeof item.completed === "boolean" &&
        typeof item.createdBy === "string" &&
        Number.isFinite(item.createdAt) &&
        (item.completedBy === null || typeof item.completedBy === "string") &&
        (item.completedAt === null || Number.isFinite(item.completedAt)),
    },
  );

  const add = useCallback<SharedChecklist["add"]>(
    (rawText, addOptions) => {
      const text = rawText.trim();
      if (
        !room ||
        !text ||
        text.length > maxTextLength ||
        collection.items.length >= maxItems
      ) {
        return null;
      }
      const item: SharedChecklistItem = {
        id: addOptions?.id ?? makeId(),
        text,
        completed: false,
        createdBy: room.peerId,
        createdAt: now(),
        completedBy: null,
        completedAt: null,
      };
      return collection.add(item) ? item : null;
    },
    [collection, maxItems, maxTextLength, now, room],
  );

  const setCompleted = useCallback<SharedChecklist["setCompleted"]>(
    (id, completed) => {
      const existing = collection.byId(id);
      if (!existing || !room || existing.completed === completed) return false;
      return collection.update(id, {
        completed,
        completedBy: completed ? room.peerId : null,
        completedAt: completed ? now() : null,
      });
    },
    [collection, now, room],
  );

  const toggle = useCallback<SharedChecklist["toggle"]>(
    (id) => {
      const existing = collection.byId(id);
      return existing ? setCompleted(id, !existing.completed) : false;
    },
    [collection, setCompleted],
  );

  const completedCount = collection.items.filter(
    (item) => item.completed,
  ).length;
  return {
    items: collection.items,
    openCount: collection.items.length - completedCount,
    completedCount,
    add,
    setCompleted,
    toggle,
    remove: collection.remove,
    clear: collection.clear,
  };
}
