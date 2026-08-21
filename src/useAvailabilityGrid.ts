import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type AvailabilityGrid = {
  availability: Record<string, string[]>;
  setAvailable: (slot: string, available: boolean, peerId?: string) => void;
  commonSlots: string[];
  bestSlots: string[];
};

/** A validated, deterministic peer-to-slot availability matrix backed by a Y.Map. */
export function useAvailabilityGrid(
  room: YRoom | null,
  key = "availability",
  peers: string[] = [],
): AvailabilityGrid {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<string[]>(key);
    const onChange = () => rerender((n) => n + 1);
    map.observe(onChange);
    return () => map.unobserve(onChange);
  }, [room, key]);
  const map = room?.doc.getMap<string[]>(key);
  const availability: Record<string, string[]> = {};
  map?.forEach((slots, peer) => {
    availability[peer] = Array.isArray(slots)
      ? [
          ...new Set(
            slots.filter(
              (slot) => typeof slot === "string" && slot.length <= 128,
            ),
          ),
        ].sort()
      : [];
  });
  const selectedPeers = peers.length
    ? [...new Set(peers)].sort()
    : Object.keys(availability).sort();
  const counts = new Map<string, number>();
  Object.values(availability).forEach((slots) =>
    slots.forEach((slot) => counts.set(slot, (counts.get(slot) ?? 0) + 1)),
  );
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slot]) => slot);
  return {
    availability,
    setAvailable: (slot, available, peerId = room?.peerId ?? "") => {
      if (
        !map ||
        !peerId ||
        typeof slot !== "string" ||
        !slot.trim() ||
        slot.length > 128
      )
        return;
      const current = Array.isArray(map.get(peerId)) ? map.get(peerId)! : [];
      const next = available
        ? [...new Set([...current, slot.trim()])].sort()
        : current.filter((entry) => entry !== slot.trim());
      map.set(peerId, next);
    },
    commonSlots: selectedPeers.length
      ? ranked.filter(
          (slot) => (counts.get(slot) ?? 0) === selectedPeers.length,
        )
      : [],
    bestSlots: ranked,
  };
}
