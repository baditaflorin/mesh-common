import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type PerPeerValue<T> = {
  /** This peer's current value (or the default if unset). */
  my: T;
  /** Set this peer's value. */
  setMy: (v: T) => void;
  /** Clear this peer's value. */
  clearMy: () => void;
  /** Snapshot `{ peerId: T }` of every peer's value. */
  all: Record<string, T>;
  /** Lookup another peer's value (returns undefined if unset). */
  valueOf: (peerId: string) => T | undefined;
  /** Number of peers who have a value on record. */
  size: number;
  /** Raw entries — useful for sorting or averaging across peers. */
  entries: Array<[string, T]>;
};

/**
 * Generic `Y.Map<peerId, T>` with read / write / observe. The pattern that
 * useNamedPeer applies to display names — applied to *any* per-peer value:
 * mood color, slider position, ready flag, vote weight, status emoji.
 *
 * Apps replace ~25 lines of identical Y.Map + observe + iterate boilerplate
 * with a single hook.
 *
 *   const mood = usePerPeerValue<{ hue: number }>(room, "mood", { hue: 0 });
 *   mood.setMy({ hue: 200 });
 *   const avgHue = mood.entries.reduce((s, [, v]) => s + v.hue, 0) / mood.size;
 */
export function usePerPeerValue<T>(
  room: YRoom | null,
  key: string,
  defaultValue: T,
): PerPeerValue<T> {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<T>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  const map = room ? room.doc.getMap<T>(key) : null;
  const all: Record<string, T> = {};
  const entries: Array<[string, T]> = [];
  if (map) {
    map.forEach((v, k) => {
      all[k] = v;
      entries.push([k, v]);
    });
  }
  const my = (room && map?.get(room.peerId)) ?? defaultValue;

  return {
    my,
    setMy: (v) => {
      if (!room || !map) return;
      map.set(room.peerId, v);
    },
    clearMy: () => {
      if (!room || !map) return;
      map.delete(room.peerId);
    },
    all,
    valueOf: (peerId) => (map ? map.get(peerId) : undefined),
    size: entries.length,
    entries,
  };
}
