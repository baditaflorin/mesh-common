import { useEffect, useRef, useState } from "react";
import type { YRoom } from "./useYRoom";

export type RosterState = {
  /** peerIds considered present (heartbeat within `freshnessMs`). */
  present: string[];
  /** peerIds in roster but stale (heartbeat older than `freshnessMs`). */
  absent: string[];
  /** Total peers ever heartbeated in this room. */
  total: number;
  /** Last heartbeat ms for a given peerId (undefined if never seen). */
  lastSeenOf: (peerId: string) => number | undefined;
  /** True iff `peerId` is in `present`. */
  isPresent: (peerId: string) => boolean;
};

const ROSTER_KEY = "__mesh_roster";

/**
 * Last-seen-aware presence list. Each peer heartbeats its `lastSeen` ms into
 * `Y.Map<peerId, number>("__mesh_roster")` on a configurable interval;
 * `present` is the set with `now - lastSeen < freshnessMs`.
 *
 * Replaces ad-hoc "derive presence from names map keys" patterns and gives
 * apps an explicit, stale-tolerant roster — useful for round-robin turns,
 * elimination brackets, "wait for N peers" gates.
 */
export function useRoster(
  room: YRoom | null,
  opts?: { heartbeatMs?: number; freshnessMs?: number },
): RosterState {
  const heartbeatMs = opts?.heartbeatMs ?? 5_000;
  const freshnessMs = opts?.freshnessMs ?? 15_000;
  const [, rerender] = useState(0);
  const [now, setNow] = useState(Date.now());
  const beating = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<number>(ROSTER_KEY);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<number>(ROSTER_KEY);
    const beat = () => m.set(room.peerId, Date.now());
    beat();
    beating.current = setInterval(beat, heartbeatMs);
    return () => {
      if (beating.current) clearInterval(beating.current);
    };
  }, [room, heartbeatMs]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), Math.min(heartbeatMs, 2000));
    return () => clearInterval(id);
  }, [heartbeatMs]);

  const map = room ? room.doc.getMap<number>(ROSTER_KEY) : null;
  const present: string[] = [];
  const absent: string[] = [];
  if (map) {
    map.forEach((ts, peerId) => {
      if (now - ts < freshnessMs) present.push(peerId);
      else absent.push(peerId);
    });
  }
  present.sort();
  absent.sort();

  return {
    present,
    absent,
    total: present.length + absent.length,
    lastSeenOf: (peerId) => (map ? map.get(peerId) : undefined),
    isPresent: (peerId) => map != null && now - (map.get(peerId) ?? 0) < freshnessMs,
  };
}
