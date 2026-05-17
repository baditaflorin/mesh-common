import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type VotesState<Opt extends string> = {
  /** Cast (or change) this peer's vote. */
  vote: (opt: Opt) => void;
  /** Withdraw this peer's vote. */
  unvote: () => void;
  /** This peer's current choice, or null if not yet voted. */
  myVote: Opt | null;
  /** Per-option vote count. */
  tally: Map<Opt, number>;
  /** Total number of peers who have a vote on record. */
  totalVotes: number;
  /** Top vote-getter (deterministic via Map insertion order on ties). null when empty. */
  winner: Opt | null;
  /** Percent of total for one option (0–100, rounded). */
  pctOf: (opt: Opt) => number;
};

/**
 * Single-choice voting backed by `Y.Map<peerId, optionId>`. Used by live-poll,
 * ranked-vote, would-rather, blind-date, anonymous-qa, and the moderator
 * quorum pattern. One peer = one vote; re-voting updates in place.
 *
 * Generic over a string-literal union: `useVotes<'yes' | 'no' | 'abstain'>(…)`.
 */
export function useVotes<Opt extends string>(
  room: YRoom | null,
  key: string,
  myPeerId?: string,
): VotesState<Opt> {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<Opt>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  const map = room ? room.doc.getMap<Opt>(key) : null;
  const peerId = myPeerId ?? room?.peerId ?? "";
  const myVote = (map && peerId ? map.get(peerId) : null) ?? null;

  const tally = new Map<Opt, number>();
  if (map) {
    map.forEach((v) => {
      tally.set(v, (tally.get(v) ?? 0) + 1);
    });
  }
  const totalVotes = map ? map.size : 0;

  let winner: Opt | null = null;
  let max = -1;
  for (const [opt, count] of tally) {
    if (count > max) {
      max = count;
      winner = opt;
    }
  }

  return {
    vote: (opt) => {
      if (!map || !peerId) return;
      map.set(peerId, opt);
    },
    unvote: () => {
      if (!map || !peerId) return;
      map.delete(peerId);
    },
    myVote,
    tally,
    totalVotes,
    winner,
    pctOf: (opt) => {
      if (totalVotes === 0) return 0;
      return Math.round(((tally.get(opt) ?? 0) / totalVotes) * 100);
    },
  };
}
