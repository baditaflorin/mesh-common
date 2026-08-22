import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_CHOICES = 50;
const MAX_LABEL_LENGTH = 100;
const MAX_VOTERS_PER_CHOICE = 250;

type StoredChoice = {
  id: string;
  label: string;
  createdBy: string;
  voterIds: string[];
};

export type SharedChoice = {
  id: string;
  label: string;
  createdBy: string;
  voterIds: string[];
  count: number;
};

function validId(value: unknown) {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 120
  );
}

function isStoredChoice(value: unknown): value is StoredChoice {
  if (!value || typeof value !== "object") return false;
  const choice = value as Partial<StoredChoice>;
  return (
    validId(choice.id) &&
    typeof choice.label === "string" &&
    choice.label.trim().length > 0 &&
    choice.label.length <= MAX_LABEL_LENGTH &&
    validId(choice.createdBy) &&
    Array.isArray(choice.voterIds) &&
    choice.voterIds.length <= MAX_VOTERS_PER_CHOICE &&
    choice.voterIds.every(validId)
  );
}

/**
 * A bounded collection of independently selectable shared choices. Unlike a
 * poll, a peer may select any number of choices, which suits checklists,
 * feature picks, and lightweight preference boards.
 */
export function useSharedChoices(room: YRoom | null, key = "choices") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<StoredChoice>(key);
    const update = () => rerender((version) => version + 1);
    map.observe(update);
    return () => map.unobserve(update);
  }, [room, key]);

  const map = room?.doc.getMap<StoredChoice>(key) ?? null;
  const choices = [...(map?.values() ?? [])]
    .filter(isStoredChoice)
    .map((choice) => {
      const voterIds = [...new Set(choice.voterIds)].sort();
      return { ...choice, voterIds, count: voterIds.length };
    })
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const selectedIds = room
    ? choices
        .filter((choice) => choice.voterIds.includes(room.peerId))
        .map((choice) => choice.id)
    : [];

  return {
    choices,
    selectedIds,
    add: (
      label: string,
      id = `${room?.peerId ?? "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ) => {
      const clean = label.trim();
      if (
        !room ||
        !map ||
        !validId(id) ||
        !clean ||
        clean.length > MAX_LABEL_LENGTH ||
        map.has(id) ||
        choices.length >= MAX_CHOICES
      ) {
        return false;
      }
      map.set(id, { id, label: clean, createdBy: room.peerId, voterIds: [] });
      return true;
    },
    /** Add or remove the current peer from a choice. */
    toggle: (id: string) => {
      const choice = map?.get(id);
      if (!room || !map || !isStoredChoice(choice)) return false;
      const voters = new Set(choice.voterIds);
      if (voters.has(room.peerId)) voters.delete(room.peerId);
      else if (voters.size >= MAX_VOTERS_PER_CHOICE) return false;
      else voters.add(room.peerId);
      map.set(id, { ...choice, voterIds: [...voters].sort() });
      return true;
    },
    /** Remove the current peer from all choices without altering other votes. */
    clearMine: () => {
      if (!room || !map) return false;
      let changed = false;
      room.doc.transact(() => {
        for (const [id, raw] of map.entries()) {
          if (!isStoredChoice(raw) || !raw.voterIds.includes(room.peerId))
            continue;
          map.set(id, {
            ...raw,
            voterIds: raw.voterIds.filter((peerId) => peerId !== room.peerId),
          });
          changed = true;
        }
      });
      return changed;
    },
    /** Only a choice's creator may remove it. */
    remove: (id: string) => {
      const choice = map?.get(id);
      if (
        !room ||
        !map ||
        !isStoredChoice(choice) ||
        choice.createdBy !== room.peerId
      )
        return false;
      map.delete(id);
      return true;
    },
  };
}
