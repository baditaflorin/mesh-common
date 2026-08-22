import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_ENTRIES = 300;
const MAX_ID_LENGTH = 120;
const MAX_WORD_LENGTH = 48;

export type SharedWordRelayEntry = {
  id: string;
  word: string;
  peerId: string;
  addedAt: number;
};

function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function normalizeWord(value: unknown) {
  if (typeof value !== "string") return null;
  const word = value.trim().replace(/\s+/g, " ");
  return word && word.length <= MAX_WORD_LENGTH ? word : null;
}

function isEntry(value: unknown): value is SharedWordRelayEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SharedWordRelayEntry>;
  return (
    isId(entry.id) &&
    normalizeWord(entry.word) !== null &&
    isId(entry.peerId) &&
    typeof entry.addedAt === "number" &&
    Number.isFinite(entry.addedAt)
  );
}

/**
 * An ordered, peer-attributed chain of short words or phrases.
 *
 * The primitive deliberately leaves the word-game rule to the app: callers
 * can enforce rhyme, letter matching, a theme, or simply use it as a shared
 * micro-story. Entries are bounded plain text and never executable markup.
 */
export function useSharedWordRelay(room: YRoom | null, key = "word-relay") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const list = room.doc.getArray<SharedWordRelayEntry>(key);
    const update = () => rerender((version) => version + 1);
    list.observe(update);
    return () => list.unobserve(update);
  }, [room, key]);

  const list = room?.doc.getArray<SharedWordRelayEntry>(key) ?? null;
  const entries = (list?.toArray() ?? [])
    .filter(isEntry)
    .slice(-MAX_ENTRIES)
    .sort((a, b) => a.addedAt - b.addedAt || a.id.localeCompare(b.id));

  return {
    entries,
    latest: entries.at(-1) ?? null,
    add: (
      word: string,
      id = `${room?.peerId ?? "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ) => {
      const clean = normalizeWord(word);
      if (
        !room ||
        !list ||
        !clean ||
        !isId(id) ||
        list.length >= MAX_ENTRIES ||
        list.toArray().some((entry) => isEntry(entry) && entry.id === id)
      ) {
        return false;
      }
      list.push([
        { id, word: clean, peerId: room.peerId, addedAt: Date.now() },
      ]);
      return true;
    },
    /** A peer may retract only their most recently added word. */
    undoMine: () => {
      if (!room || !list) return false;
      const values = list.toArray();
      for (let index = values.length - 1; index >= 0; index -= 1) {
        const entry = values[index];
        if (isEntry(entry) && entry.peerId === room.peerId) {
          list.delete(index, 1);
          return true;
        }
      }
      return false;
    },
    clear: () => {
      if (!list || list.length === 0) return false;
      list.delete(0, list.length);
      return true;
    },
  };
}
