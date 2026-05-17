import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "../useYRoom";

export type EloEntry = {
  peerId: string;
  rating: number;
  rank: number;
};

export type EloState = {
  /** This peer's current rating (defaults to `start`). */
  myRating: number;
  /** Lookup any peer's rating. */
  ratingOf: (peerId: string) => number;
  /** Probability that `a` beats `b` (0..1). */
  expectedScore: (a: string, b: string) => number;
  /** Record a 1v1 result. score ∈ {0, 0.5, 1} from this peer's POV vs `opponent`. */
  recordResult: (input: { opponent: string; score: 0 | 0.5 | 1 }) => void;
  /** Top-N peers by rating. */
  rankings: (limit?: number) => EloEntry[];
};

/**
 * Per-peer Elo rating for 1v1 matches. Composes with `usePairing` (matchmaking)
 * + `useMatchHistory` (call `recordResult` at round end).
 *
 *   const elo = useElo(room, "elo");
 *   onWin = () => elo.recordResult({ opponent, score: 1 });
 *   elo.rankings(5)  // top 5 by rating
 *
 * Defaults: start=1500, K=32 (standard chess). Lower K (e.g. 16) for more
 * stable ratings; higher K (e.g. 64) for faster convergence in casual play.
 */
export function useElo(
  room: YRoom | null,
  key: string,
  opts?: { start?: number; kFactor?: number },
): EloState {
  const start = opts?.start ?? 1500;
  const K = opts?.kFactor ?? 32;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<number>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  const map = room ? room.doc.getMap<number>(key) : null;
  const myPeer = room?.peerId ?? "";

  const ratingOf = useCallback(
    (peerId: string) => (map ? (map.get(peerId) ?? start) : start),
    [map, start],
  );

  const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

  const expectedScore = useCallback(
    (a: string, b: string) => expected(ratingOf(a), ratingOf(b)),
    [ratingOf],
  );

  const recordResult = useCallback(
    ({ opponent, score }: { opponent: string; score: 0 | 0.5 | 1 }) => {
      if (!map || !room || opponent === room.peerId) return;
      const ra = ratingOf(room.peerId);
      const rb = ratingOf(opponent);
      const ea = expected(ra, rb);
      const eb = expected(rb, ra);
      const newA = Math.round(ra + K * (score - ea));
      const newB = Math.round(rb + K * (1 - score - eb));
      room.doc.transact(() => {
        map.set(room.peerId, newA);
        map.set(opponent, newB);
      });
    },
    [map, room, ratingOf, K],
  );

  const rankings = useCallback(
    (limit?: number): EloEntry[] => {
      if (!map) return [];
      const entries: EloEntry[] = [];
      map.forEach((rating, peerId) => entries.push({ peerId, rating, rank: 0 }));
      entries.sort((a, b) => b.rating - a.rating || a.peerId.localeCompare(b.peerId));
      entries.forEach((e, i) => (e.rank = i + 1));
      return limit ? entries.slice(0, limit) : entries;
    },
    [map],
  );

  return {
    myRating: ratingOf(myPeer),
    ratingOf,
    expectedScore,
    recordResult,
    rankings,
  };
}
