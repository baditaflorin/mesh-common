import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_NOTES = 200;
const MAX_ID_LENGTH = 120;
const MAX_TEXT_LENGTH = 500;
const MAX_COORDINATE = 10_000;
const COLORS = new Set(["amber", "blue", "coral", "mint", "violet"]);

export type SharedStickyNote = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: "amber" | "blue" | "coral" | "mint" | "violet";
  createdBy: string;
  createdAt: number;
};

function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function isCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_COORDINATE
  );
}

function isColor(value: unknown): value is SharedStickyNote["color"] {
  return typeof value === "string" && COLORS.has(value);
}

function isStickyNote(value: unknown): value is SharedStickyNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<SharedStickyNote>;
  return (
    isId(note.id) &&
    typeof note.text === "string" &&
    note.text.trim().length > 0 &&
    note.text.length <= MAX_TEXT_LENGTH &&
    isCoordinate(note.x) &&
    isCoordinate(note.y) &&
    isColor(note.color) &&
    isId(note.createdBy) &&
    typeof note.createdAt === "number" &&
    Number.isFinite(note.createdAt)
  );
}

/**
 * A bounded spatial board of peer-attributed sticky notes.
 *
 * Notes remain plain data: the hook validates their text, coordinates, and
 * colour token before publishing them. This makes it useful for mood boards,
 * retrospectives, and lightweight collaborative canvases without requiring a
 * drawing surface.
 */
export function useSharedStickyBoard(room: YRoom | null, key = "sticky-board") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const list = room.doc.getArray<SharedStickyNote>(key);
    const update = () => rerender((version) => version + 1);
    list.observe(update);
    return () => list.unobserve(update);
  }, [room, key]);

  const list = room?.doc.getArray<SharedStickyNote>(key) ?? null;
  const notes = (list?.toArray() ?? [])
    .filter(isStickyNote)
    .slice(-MAX_NOTES)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const find = (id: string) => {
    const values = list?.toArray() ?? [];
    const index = values.findIndex(
      (note) => isStickyNote(note) && note.id === id,
    );
    const note = index < 0 ? null : values[index];
    return note && isStickyNote(note) ? { index, note } : null;
  };

  return {
    notes,
    add: (
      text: string,
      options: {
        id?: string;
        x?: number;
        y?: number;
        color?: SharedStickyNote["color"];
      } = {},
    ) => {
      const clean = typeof text === "string" ? text.trim() : "";
      const id =
        options.id ??
        `${room?.peerId ?? "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const x = options.x ?? 0;
      const y = options.y ?? 0;
      const color = options.color ?? "amber";
      if (
        !room ||
        !list ||
        !isId(id) ||
        !clean ||
        clean.length > MAX_TEXT_LENGTH ||
        !isCoordinate(x) ||
        !isCoordinate(y) ||
        !isColor(color) ||
        list.length >= MAX_NOTES ||
        find(id)
      ) {
        return false;
      }
      list.push([
        {
          id,
          text: clean,
          x,
          y,
          color,
          createdBy: room.peerId,
          createdAt: Date.now(),
        },
      ]);
      return true;
    },
    /** Move a note. Any peer may arrange the common board. */
    move: (id: string, x: number, y: number) => {
      const current = find(id);
      if (!room || !list || !current || !isCoordinate(x) || !isCoordinate(y)) {
        return false;
      }
      room.doc.transact(() => {
        list.delete(current.index, 1);
        list.insert(current.index, [{ ...current.note, x, y }]);
      });
      return true;
    },
    /** Keep edits attributable: only the original author may change text. */
    editMine: (id: string, text: string) => {
      const current = find(id);
      const clean = typeof text === "string" ? text.trim() : "";
      if (
        !room ||
        !list ||
        !current ||
        current.note.createdBy !== room.peerId ||
        !clean ||
        clean.length > MAX_TEXT_LENGTH
      ) {
        return false;
      }
      room.doc.transact(() => {
        list.delete(current.index, 1);
        list.insert(current.index, [{ ...current.note, text: clean }]);
      });
      return true;
    },
    removeMine: (id: string) => {
      const current = find(id);
      if (
        !list ||
        !room ||
        !current ||
        current.note.createdBy !== room.peerId
      ) {
        return false;
      }
      list.delete(current.index, 1);
      return true;
    },
  };
}
