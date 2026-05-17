import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type EventLog<T> = {
  /** All events in insertion order. Cheap to read — backed by `Y.Array.toArray()`. */
  events: T[];
  /** Append one event. */
  push: (event: T) => void;
  /** Most-recent N events (default 20). */
  latest: (n?: number) => T[];
  /** Filter by `peerId` field if present on the event type. */
  byPeer: (peerId: string) => T[];
  /** Drop all events. */
  clear: () => void;
  /** Number of events currently in the log. */
  size: number;
};

/**
 * Append-only event log backed by `Y.Array<T>`. Used by tag history,
 * favor-bank transactions, thank-you tokens, mesh toasts, treasure-hunt
 * progress, etc. — anywhere a "feed of things peers did" is the right shape.
 *
 * Re-renders the consumer when ANY peer pushes a new event. Generic over the
 * event shape: pass `{ peerId, ts, ... }` and `byPeer` will work automatically.
 */
export function useEventLog<T extends { peerId?: string }>(
  room: YRoom | null,
  key: string,
): EventLog<T> {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<T>(key);
    const cb = () => rerender((n) => n + 1);
    arr.observe(cb);
    return () => arr.unobserve(cb);
  }, [room, key]);

  const arr = room ? room.doc.getArray<T>(key) : null;
  const events = arr ? arr.toArray() : [];

  return {
    events,
    size: events.length,
    push: (event) => {
      if (!arr) return;
      arr.push([event]);
    },
    latest: (n = 20) => events.slice(-n).reverse(),
    byPeer: (peerId) => events.filter((e) => e.peerId === peerId),
    clear: () => {
      if (!arr) return;
      arr.delete(0, arr.length);
    },
  };
}
