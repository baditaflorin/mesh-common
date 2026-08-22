import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_CELLS = 36;
const MAX_CELL_ID_LENGTH = 80;
const MAX_LABEL_LENGTH = 100;
const MAX_CLAIMERS_PER_CELL = 250;

export type SharedBingoCell = {
  id: string;
  label: string;
  claimedBy: string[];
  claimed: boolean;
  claimCount: number;
};

type StoredCell = Omit<SharedBingoCell, "claimed" | "claimCount">;

function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_CELL_ID_LENGTH
  );
}

function isStoredCell(value: unknown): value is StoredCell {
  if (!value || typeof value !== "object") return false;
  const cell = value as Partial<StoredCell>;
  return (
    isId(cell.id) &&
    typeof cell.label === "string" &&
    cell.label.trim().length > 0 &&
    cell.label.length <= MAX_LABEL_LENGTH &&
    Array.isArray(cell.claimedBy) &&
    cell.claimedBy.length <= MAX_CLAIMERS_PER_CELL &&
    cell.claimedBy.every(isId)
  );
}

/**
 * A shared, configurable bingo board where every peer may mark their own
 * progress. Board configuration is kept distinct from claims, so re-rendering
 * a UI never loses who has already completed a square.
 */
export function useSharedBingoBoard(room: YRoom | null, key = "bingo-board") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const cells = room.doc.getMap<StoredCell>(key);
    const update = () => rerender((version) => version + 1);
    cells.observe(update);
    return () => cells.unobserve(update);
  }, [room, key]);

  const map = room?.doc.getMap<StoredCell>(key) ?? null;
  const cells = [...(map?.values() ?? [])]
    .filter(isStoredCell)
    .map((cell) => {
      const claimedBy = [...new Set(cell.claimedBy)].sort();
      return {
        ...cell,
        claimedBy,
        claimed: room ? claimedBy.includes(room.peerId) : false,
        claimCount: claimedBy.length,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    cells,
    /** Replace the board while retaining claims for cells with the same id. */
    configure: (next: Array<{ id: string; label: string }>) => {
      if (
        !map ||
        !Array.isArray(next) ||
        next.length === 0 ||
        next.length > MAX_CELLS ||
        next.some(
          (cell) =>
            !isId(cell.id) ||
            typeof cell.label !== "string" ||
            !cell.label.trim() ||
            cell.label.length > MAX_LABEL_LENGTH,
        ) ||
        new Set(next.map((cell) => cell.id)).size !== next.length
      ) {
        return false;
      }
      room?.doc.transact(() => {
        const replacement = new Set(next.map((cell) => cell.id));
        for (const id of [...map.keys()]) {
          if (!replacement.has(id)) map.delete(id);
        }
        for (const cell of next) {
          const existing = map.get(cell.id);
          map.set(cell.id, {
            id: cell.id,
            label: cell.label.trim(),
            claimedBy: isStoredCell(existing) ? existing.claimedBy : [],
          });
        }
      });
      return true;
    },
    toggleMine: (id: string) => {
      const cell = map?.get(id);
      if (!room || !map || !isStoredCell(cell)) return false;
      const claimers = new Set(cell.claimedBy);
      if (claimers.has(room.peerId)) claimers.delete(room.peerId);
      else if (claimers.size >= MAX_CLAIMERS_PER_CELL) return false;
      else claimers.add(room.peerId);
      map.set(id, { ...cell, claimedBy: [...claimers].sort() });
      return true;
    },
    clearMine: () => {
      if (!room || !map) return false;
      let changed = false;
      room.doc.transact(() => {
        for (const [id, cell] of map.entries()) {
          if (!isStoredCell(cell) || !cell.claimedBy.includes(room.peerId))
            continue;
          map.set(id, {
            ...cell,
            claimedBy: cell.claimedBy.filter(
              (peerId) => peerId !== room.peerId,
            ),
          });
          changed = true;
        }
      });
      return changed;
    },
    clear: () => {
      if (!map || map.size === 0) return false;
      map.clear();
      return true;
    },
  };
}
