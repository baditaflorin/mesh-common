import { useCallback, useEffect, useMemo, useState } from "react";
import type { YRoom } from "./useYRoom";

/**
 * Ephemeral, auto-broadcast per-peer state via y-protocols/awareness.
 *
 * Different from `useRoster` (heartbeat-based) and `usePerPeerValue` (CRDT-persisted):
 *  - awareness is *ephemeral* — disappears the moment a peer disconnects
 *  - awareness is *not* in the CRDT history — no GC, no monotone growth
 *  - awareness is *push* — y-webrtc broadcasts on every change
 *
 * Use for: cursors, "alice is typing…", live reaction emoji, focus rings,
 * "I'm currently looking at slide 4" — anything where stale state is worse
 * than missing state.
 *
 *   const aw = useAwareness<{ name: string; typing: boolean }>(room);
 *   aw.setLocal({ name: "alice", typing: true });
 *   aw.peers.forEach((s, peerId) => …);
 */

export type AwarenessApi<T extends object> = {
  /** Current local state (what *this* peer is broadcasting). */
  local: T | null;
  /** Merge a partial into local state and broadcast. */
  setLocal: (patch: Partial<T> | null) => void;
  /** All peers' awareness states, keyed by `peerId` (excludes self by default). */
  peers: Map<string, T>;
  /** Count of currently-broadcasting peers (excludes self). */
  count: number;
  /** Including self — useful for "who's online" UIs. */
  all: Map<string, T>;
};

type RawAwareness = {
  clientID: number;
  getStates: () => Map<number, Record<string, unknown>>;
  getLocalState: () => Record<string, unknown> | null;
  setLocalState: (s: Record<string, unknown> | null) => void;
  setLocalStateField: (k: string, v: unknown) => void;
  on: (e: string, cb: () => void) => void;
  off: (e: string, cb: () => void) => void;
};

function getAwareness(room: YRoom | null): RawAwareness | null {
  const provider = room?.provider as unknown as { awareness?: RawAwareness } | null;
  return provider?.awareness ?? null;
}

/**
 * Resolve a numeric y-awareness clientID to the human-readable peerId used by
 * the rest of mesh-common. y-webrtc sets `awareness.clientID === doc.clientID`,
 * and `room.peerId` is derived from `doc.clientID` at room creation. For self
 * we know the mapping exactly; for remote peers the awareness state often
 * carries `__peerId` (we add it automatically below).
 */
const PEER_FIELD = "__peerId";

export function useAwareness<T extends object = Record<string, unknown>>(
  room: YRoom | null,
): AwarenessApi<T> {
  const [tick, setTick] = useState(0);
  const aw = getAwareness(room);

  useEffect(() => {
    if (!aw || !room) return;
    aw.setLocalStateField(PEER_FIELD, room.peerId);
    const cb = () => setTick((n) => n + 1);
    aw.on("change", cb);
    return () => {
      aw.off("change", cb);
      try {
        aw.setLocalState(null);
      } catch {
        // teardown best-effort
      }
    };
  }, [aw, room?.peerId]);

  const setLocal = useCallback(
    (patch: Partial<T> | null) => {
      if (!aw) return;
      if (patch === null) {
        aw.setLocalState({ [PEER_FIELD]: room?.peerId });
        return;
      }
      const cur = (aw.getLocalState() ?? {}) as Record<string, unknown>;
      const next = { ...cur, ...patch, [PEER_FIELD]: room?.peerId } as Record<string, unknown>;
      aw.setLocalState(next);
    },
    [aw, room?.peerId],
  );

  const { local, peers, all } = useMemo(() => {
    const peers = new Map<string, T>();
    const all = new Map<string, T>();
    let local: T | null = null;
    if (!aw) return { local, peers, all };
    const states = aw.getStates();
    for (const [clientID, raw] of states.entries()) {
      if (!raw) continue;
      const peerId = (raw[PEER_FIELD] as string | undefined) ?? String(clientID);
      const clean = { ...raw } as Record<string, unknown>;
      delete clean[PEER_FIELD];
      const t = clean as T;
      all.set(peerId, t);
      if (clientID === aw.clientID) {
        local = t;
      } else {
        peers.set(peerId, t);
      }
    }
    return { local, peers, all };
  }, [aw, tick]);

  return { local, setLocal, peers, count: peers.size, all };
}
