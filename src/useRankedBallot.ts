import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type RankedBallotResult = {
  winner: string | null;
  scores: Record<string, number>;
};
export type RankedBallot = {
  ballot: string[];
  rank: (choice: string) => void;
  clear: () => void;
  tally: () => RankedBallotResult;
  result: RankedBallotResult;
};

/** Stores each peer's ranked choices and calculates a deterministic Borda tally. */
export function useRankedBallot(
  room: YRoom | null,
  key = "ranked-ballot",
): RankedBallot {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<string[]>(key);
    const cb = () => rerender((n) => n + 1);
    map.observe(cb);
    return () => map.unobserve(cb);
  }, [room, key]);
  const map = room?.doc.getMap<string[]>(key);
  const ballot =
    room && Array.isArray(map?.get(room.peerId)) ? map!.get(room.peerId)! : [];
  const tally = (): RankedBallotResult => {
    const scores: Record<string, number> = {};
    map?.forEach((ranks) => {
      if (!Array.isArray(ranks)) return;
      [...new Set(ranks)].forEach((choice, index, all) => {
        if (typeof choice === "string" && choice.length <= 128)
          scores[choice] = (scores[choice] ?? 0) + all.length - index;
      });
    });
    const winner =
      Object.entries(scores).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0]?.[0] ?? null;
    return { winner, scores };
  };
  const result = tally();
  return {
    ballot,
    rank: (choice) => {
      if (!map || !room || !choice.trim() || choice.length > 128) return;
      const current = Array.isArray(map.get(room.peerId))
        ? map.get(room.peerId)!
        : [];
      map.set(room.peerId, [
        ...current.filter((entry) => entry !== choice),
        choice,
      ]);
    },
    clear: () => {
      if (map && room) map.delete(room.peerId);
    },
    tally,
    result,
  };
}
