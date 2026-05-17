import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "../useYRoom";

export type MatchRecord<T = unknown> = {
  id: string;
  ts: number;
  /** peerIds who played. */
  players: string[];
  /** Single winner (null on draw). */
  winnerId: string | null;
  /** App-specific extra data — moves, score, etc. */
  payload: T;
};

export type MatchStats = {
  wins: number;
  losses: number;
  draws: number;
  played: number;
  winRate: number; // wins / played, 0..1
};

export type MatchHistoryState<T> = {
  /** All recorded rounds in insertion order. */
  rounds: MatchRecord<T>[];
  /** Most-recent N rounds (default 20), latest first. */
  latest: (n?: number) => MatchRecord<T>[];
  /** The last completed round. */
  lastRound: MatchRecord<T> | null;
  /** Aggregate stats for one peer. */
  statsOf: (peerId: string) => MatchStats;
  /** Record a finished round. */
  recordRound: (input: Omit<MatchRecord<T>, "id" | "ts">) => string;
  /** Total round count. */
  size: number;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Append-only match history with built-in per-peer stats. Powers any app
 * with discrete rounds: rps-arena, bracket, tournament-tracker, dare-wheel.
 *
 *   const history = useMatchHistory<{ moves: { a: string; b: string } }>(
 *     room, "rps-history"
 *   );
 *   onEnd = () => history.recordRound({
 *     players: [alice, bob], winnerId: alice, payload: { moves: {...} }
 *   });
 *   const aliceStats = history.statsOf(alice);
 */
export function useMatchHistory<T = unknown>(
  room: YRoom | null,
  key: string,
): MatchHistoryState<T> {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<MatchRecord<T>>(key);
    const cb = () => rerender((n) => n + 1);
    arr.observe(cb);
    return () => arr.unobserve(cb);
  }, [room, key]);

  const arr = room ? room.doc.getArray<MatchRecord<T>>(key) : null;
  const rounds = arr ? arr.toArray() : [];

  const recordRound = useCallback(
    (input: Omit<MatchRecord<T>, "id" | "ts">) => {
      if (!arr) return "";
      const rec: MatchRecord<T> = {
        ...input,
        id: newId(),
        ts: Date.now(),
      };
      arr.push([rec]);
      return rec.id;
    },
    [arr],
  );

  const statsOf = useCallback(
    (peerId: string): MatchStats => {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let played = 0;
      for (const r of rounds) {
        if (!r.players.includes(peerId)) continue;
        played += 1;
        if (r.winnerId == null) draws += 1;
        else if (r.winnerId === peerId) wins += 1;
        else losses += 1;
      }
      return {
        wins,
        losses,
        draws,
        played,
        winRate: played === 0 ? 0 : wins / played,
      };
    },
    [rounds],
  );

  return {
    rounds,
    latest: (n = 20) => rounds.slice(-n).reverse(),
    lastRound: rounds.length > 0 ? rounds[rounds.length - 1]! : null,
    statsOf,
    recordRound,
    size: rounds.length,
  };
}
