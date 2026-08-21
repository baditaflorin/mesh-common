import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "../useYRoom";

export type LeaderboardEntry = {
  peerId: string;
  xp: number;
  level: number;
  rank: number;
};

export type XPState = {
  /** This peer's cumulative XP. */
  myXP: number;
  /** This peer's level (derived via levelCurve). */
  myLevel: number;
  /** ms-resolution snapshot of every peer's XP. */
  all: Record<string, number>;
  /** Lookup another peer's XP. */
  xpOf: (peerId: string) => number;
  /** Compute the level for a given XP value. */
  levelOf: (xp: number) => number;
  /** Award XP to this peer (positive number). */
  awardXP: (amount: number) => void;
  /**
   * Award XP to a specific peer (moderator-issued rewards).
   *
   * No-ops unless `opts.canAwardTo` was passed and returns true for this
   * peerId at call time — see the `canAwardTo` option below.
   */
  awardTo: (peerId: string, amount: number) => void;
  /** Top-N leaderboard. */
  leaderboard: (limit?: number) => LeaderboardEntry[];
};

const DEFAULT_CURVE = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 10));

/**
 * Per-peer cumulative XP + level ladder. Replaces ad-hoc leaderboard math.
 * Composes with `useMatchHistory` (award XP at end of round) and
 * `<Leaderboard/>` (render the ranked list).
 *
 *   const xp = useXP(room, "xp");
 *   onWin = () => xp.awardXP(10);
 *   xp.leaderboard(10).map(...)
 *
 * `levelCurve` defaults to `floor(sqrt(xp/10))` — i.e. 0→0, 10→1, 40→2,
 * 90→3, 160→4 ... Provide a custom curve for steeper / shallower ladders.
 *
 * `awardTo` (granting XP to a peer *other than yourself*) is disabled by
 * default — the underlying `Y.Map` is writable by every connected peer, so
 * without a check anyone could call `awardTo(victim, -amount-worth-of-abuse)`
 * or farm XP onto themselves via someone else's key. Pass `canAwardTo` to
 * authorize it (e.g. gate on `useModerator(...).isMe`):
 *
 *   const xp = useXP(room, "xp", { canAwardTo: () => moderator.isMe });
 */
export function useXP(
  room: YRoom | null,
  key: string,
  opts?: {
    levelCurve?: (xp: number) => number;
    /** Called as `canAwardTo(targetPeerId)` before every `awardTo`; the
     *  award is dropped unless this returns true. Defaults to always-false
     *  (i.e. `awardTo` is a no-op until an app explicitly authorizes it). */
    canAwardTo?: (peerId: string) => boolean;
  },
): XPState {
  const levelOf = opts?.levelCurve ?? DEFAULT_CURVE;
  const canAwardTo = opts?.canAwardTo ?? (() => false);
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
  const myXP = map?.get(myPeer) ?? 0;

  const all: Record<string, number> = {};
  if (map) map.forEach((v, k) => (all[k] = v));

  const award = (peerId: string, amount: number) => {
    if (!map) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    const cur = map.get(peerId) ?? 0;
    map.set(peerId, cur + amount);
  };

  return {
    myXP,
    myLevel: levelOf(myXP),
    all,
    xpOf: (pid) => all[pid] ?? 0,
    levelOf,
    awardXP: useCallback((amount: number) => award(myPeer, amount), [myPeer, map]),
    awardTo: useCallback(
      (peerId: string, amount: number) => {
        if (!canAwardTo(peerId)) return;
        award(peerId, amount);
      },
      [map, canAwardTo],
    ),
    leaderboard: useCallback(
      (limit?: number): LeaderboardEntry[] => {
        const entries = Object.entries(all)
          .map(([peerId, xp]) => ({ peerId, xp, level: levelOf(xp), rank: 0 }))
          .sort((a, b) => b.xp - a.xp || a.peerId.localeCompare(b.peerId));
        entries.forEach((e, i) => (e.rank = i + 1));
        return limit ? entries.slice(0, limit) : entries;
      },
      [all, levelOf],
    ),
  };
}
