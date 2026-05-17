import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "../useYRoom";

export type AchievementDef = {
  id: string;
  name: string;
  hint?: string;
  /** Visual hint (emoji / icon). */
  icon?: string;
};

export type AchievementsState = {
  /** Set of badge ids this peer has earned. */
  myBadges: Set<string>;
  /** All earned badges across all peers, keyed by peerId. */
  all: Record<string, string[]>;
  /** Lookup badges for one peer. */
  badgesOf: (peerId: string) => string[];
  /** True iff this peer has earned `badgeId`. */
  hasBadge: (badgeId: string) => boolean;
  /** Award a badge to this peer. No-op if already earned. */
  unlock: (badgeId: string) => boolean;
  /** Iterate definitions for UI rendering. */
  defs: AchievementDef[];
  /** Resolve a badge definition by id. */
  defOf: (badgeId: string) => AchievementDef | null;
};

/**
 * Peer-earned named badges. Each peer's earned set lives in `Y.Map<peerId,
 * string[]>`. Drop in for any gamified app to add "first win", "5-streak",
 * "moderator of N rounds", etc.
 *
 *   const ach = useAchievements(room, "badges", [
 *     { id: "first-win", name: "First win!", icon: "🥇" },
 *     { id: "streak-5", name: "5 wins in a row", icon: "🔥", hint: "streak" },
 *   ]);
 *   onWin = () => {
 *     ach.unlock("first-win");
 *     if (streak >= 5) ach.unlock("streak-5");
 *   };
 */
export function useAchievements(
  room: YRoom | null,
  key: string,
  defs: AchievementDef[],
): AchievementsState {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<string[]>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  const map = room ? room.doc.getMap<string[]>(key) : null;
  const myPeer = room?.peerId ?? "";
  const myList = map?.get(myPeer) ?? [];
  const myBadges = new Set(myList);

  const all: Record<string, string[]> = {};
  if (map) map.forEach((v, k) => (all[k] = [...v]));

  const unlock = useCallback(
    (badgeId: string): boolean => {
      if (!map || !room) return false;
      const cur = map.get(room.peerId) ?? [];
      if (cur.includes(badgeId)) return false;
      map.set(room.peerId, [...cur, badgeId]);
      return true;
    },
    [room, map],
  );

  return {
    myBadges,
    all,
    badgesOf: (pid) => all[pid] ?? [],
    hasBadge: (id) => myBadges.has(id),
    unlock,
    defs,
    defOf: (id) => defs.find((d) => d.id === id) ?? null,
  };
}
