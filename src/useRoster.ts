import { useEffect, useRef, useState } from "react";
import type { YRoom } from "./useYRoom";

export type RosterState = {
  /** peerIds considered present (heartbeat within `freshnessMs`), deduped by device. */
  present: string[];
  /** peerIds in roster but stale (heartbeat older than `freshnessMs`), deduped by device. */
  absent: string[];
  /** Total distinct devices ever heartbeated in this room. */
  total: number;
  /** Last heartbeat ms for a given peerId (undefined if never seen). */
  lastSeenOf: (peerId: string) => number | undefined;
  /** True iff `peerId` is in `present`. */
  isPresent: (peerId: string) => boolean;
};

const ROSTER_KEY = "__mesh_roster";
const ROSTER_DEVICE_KEY = "__mesh_roster_device";

/**
 * Last-seen-aware presence list. Each peer heartbeats its `lastSeen` ms into
 * `Y.Map<peerId, number>("__mesh_roster")` on a configurable interval;
 * `present` is the set with `now - lastSeen < freshnessMs`.
 *
 * Replaces ad-hoc "derive presence from names map keys" patterns and gives
 * apps an explicit, stale-tolerant roster — useful for round-robin turns,
 * elimination brackets, "wait for N peers" gates.
 *
 * Refreshing the tab gives a peer a brand-new `peerId` (see `useYRoom`), so
 * without help the roster would briefly show both the old and new peerId as
 * distinct, present people — double-counting one human for up to
 * `freshnessMs`. To prevent that, each heartbeat also tags its `peerId` with
 * `room.deviceId` (a browser-stable id, unlike `peerId`) in a companion
 * `Y.Map<peerId, string>("__mesh_roster_device")`. `present`/`absent`/`total`
 * then dedupe by device, keeping only the most-recently-seen `peerId` per
 * device. On (re)join, a peer also best-effort deletes any roster entries
 * left behind under its own device id's earlier `peerId`s — bounding map
 * growth across long sessions with many refreshes. Peers with no known
 * device (an older `useYRoom`, or a hand-built `YRoom` in tests) fall back
 * to being their own group, i.e. the pre-dedupe behavior.
 */
export function useRoster(
  room: YRoom | null,
  opts?: {
    heartbeatMs?: number;
    freshnessMs?: number;
    /**
     * Keep every browser session instead of collapsing tabs by persisted
     * browser id. Defaults to true for person-oriented roster use cases.
     */
    dedupeByDevice?: boolean;
  },
): RosterState {
  const heartbeatMs = opts?.heartbeatMs ?? 5_000;
  const freshnessMs = opts?.freshnessMs ?? 15_000;
  const dedupeByDevice = opts?.dedupeByDevice ?? true;
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
    const d = room.doc.getMap<string>(ROSTER_DEVICE_KEY);
    const beat = () => {
      m.set(room.peerId, Date.now());
      if (room.deviceId) d.set(room.peerId, room.deviceId);
    };

    // Best-effort GC: this browser's earlier sessions (pre-refresh peerIds)
    // left roster entries tagged with the same deviceId. Drop them now that
    // we know this device has rejoined under a new peerId.
    if (room.deviceId && dedupeByDevice) {
      const stale: string[] = [];
      d.forEach((otherDeviceId, otherPeerId) => {
        if (otherPeerId !== room.peerId && otherDeviceId === room.deviceId) {
          stale.push(otherPeerId);
        }
      });
      stale.forEach((peerId) => {
        m.delete(peerId);
        d.delete(peerId);
      });
    }

    beat();
    beating.current = setInterval(beat, heartbeatMs);
    return () => {
      if (beating.current) clearInterval(beating.current);
    };
  }, [dedupeByDevice, room, heartbeatMs]);

  useEffect(() => {
    const id = setInterval(
      () => setNow(Date.now()),
      Math.min(heartbeatMs, 2000),
    );
    return () => clearInterval(id);
  }, [heartbeatMs]);

  const map = room ? room.doc.getMap<number>(ROSTER_KEY) : null;
  const deviceMap = room ? room.doc.getMap<string>(ROSTER_DEVICE_KEY) : null;
  const present: string[] = [];
  const absent: string[] = [];
  if (map) {
    // Group peerIds by device so a refresh — where the old peerId is still
    // "fresh" for a few seconds after the new one joins — doesn't count as a
    // second distinct person. PeerIds with no known device (older peers, or
    // a `room` without `deviceId`) are each their own group, unchanged from
    // before this dedup existed.
    const bestOfGroup = new Map<string, { peerId: string; ts: number }>();
    map.forEach((ts, peerId) => {
      const groupKey = dedupeByDevice
        ? (deviceMap?.get(peerId) ?? `peer:${peerId}`)
        : `peer:${peerId}`;
      const current = bestOfGroup.get(groupKey);
      if (
        !current ||
        ts > current.ts ||
        (ts === current.ts && peerId < current.peerId)
      ) {
        bestOfGroup.set(groupKey, { peerId, ts });
      }
    });
    bestOfGroup.forEach(({ peerId, ts }) => {
      if (now - ts < freshnessMs) present.push(peerId);
      else absent.push(peerId);
    });
  }
  present.sort();
  absent.sort();
  const presentSet = new Set(present);

  return {
    present,
    absent,
    total: present.length + absent.length,
    lastSeenOf: (peerId) => (map ? map.get(peerId) : undefined),
    isPresent: (peerId) => presentSet.has(peerId),
  };
}
