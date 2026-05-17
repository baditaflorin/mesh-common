import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type ClaimRecord = {
  peerId: string;
  ts: number;
  ttl: number;
};

export type ExpiringClaim = {
  /** peerId that holds the (non-expired) claim, or null if free. */
  claimedBy: string | null;
  /** True iff this peer holds the claim. */
  isMine: boolean;
  /** True iff no peer holds an unexpired claim. */
  isFree: boolean;
  /** ms until the current claim expires (0 if free). */
  msRemaining: number;
  /** Claim the slot for this peer. Overwrites any prior claim. */
  claim: () => void;
  /** Release this peer's claim (no-op if it was someone else's). */
  release: () => void;
  /** Refresh this peer's claim TTL without losing the slot. */
  refresh: () => void;
};

/**
 * Anti-zombie soft lock backed by `Y.Map<key, ClaimRecord>`. Render-time
 * filter prunes stale claims based on `ts + ttl < now` — no cleanup pass
 * needed. Powers DJ-slot ("I'm playing for 60s"), debate side ("I claim
 * affirmative"), and spotlight volunteering.
 *
 *   const dj = useExpiringClaim(room, "now-playing", 60_000);
 *   if (dj.isFree) <button onClick={dj.claim}>take the deck</button>
 *   if (dj.isMine) <button onClick={dj.refresh}>keep going</button>
 */
export function useExpiringClaim(
  room: YRoom | null,
  key: string,
  ttlMs: number,
  opts?: { tickMs?: number },
): ExpiringClaim {
  const tickMs = opts?.tickMs ?? 1000;
  const [, rerender] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<ClaimRecord>("__mesh_claims");
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const map = room ? room.doc.getMap<ClaimRecord>("__mesh_claims") : null;
  const rec = map?.get(key);
  const alive = rec && rec.ts + rec.ttl > now ? rec : null;
  const claimedBy = alive?.peerId ?? null;
  const isMine = !!alive && !!room && alive.peerId === room.peerId;
  const msRemaining = alive ? Math.max(0, alive.ts + alive.ttl - now) : 0;

  return {
    claimedBy,
    isMine,
    isFree: !alive,
    msRemaining,
    claim: () => {
      if (!room || !map) return;
      map.set(key, { peerId: room.peerId, ts: Date.now(), ttl: ttlMs });
    },
    release: () => {
      if (!room || !map) return;
      const cur = map.get(key);
      if (cur && cur.peerId === room.peerId) map.delete(key);
    },
    refresh: () => {
      if (!room || !map) return;
      const cur = map.get(key);
      if (cur && cur.peerId === room.peerId) {
        map.set(key, { ...cur, ts: Date.now(), ttl: ttlMs });
      }
    },
  };
}
