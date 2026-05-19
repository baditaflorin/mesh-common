import { useCallback, useEffect, useMemo, useState } from "react";
import type { YRoom } from "./useYRoom";

/**
 * Per-peer "last seen message N" receipts over a Y.Map. CRDT-safe: a peer's
 * seen-index is monotone (`max(prev, next)`), so two writes from the same
 * peer at different vantage points reconcile cleanly.
 *
 *   const receipts = useReadReceipts(room, { mapName: "msg-receipts" });
 *   <onScroll>{() => receipts.markSeen(latestMsgIndex)}</onScroll>
 *   receipts.readersOf(msgIndex) → peerIds whose seen-index >= msgIndex
 *
 * Privacy framing: receipts are observable to everyone in the room — that's
 * the point. If you don't want them visible, don't use this hook. We
 * deliberately *do not* sign receipts; a hostile peer can claim to have read
 * something they haven't, and that's fine (it's a soft UX cue, not consensus).
 */

export type ReadReceiptsApi = {
  /** Local peer's currently broadcasted seen-index. */
  mine: number;
  /** All peers' seen-indexes (excluding self). */
  receipts: Record<string, number>;
  /** Move our seen-index forward (monotone — calls with smaller value are no-ops). */
  markSeen: (index: number) => void;
  /** Peers whose seen-index has reached at least `index`. */
  readersOf: (index: number) => string[];
};

export type ReadReceiptsOptions = {
  /** Y.Map name inside the doc. Default "mesh:receipts". */
  mapName?: string;
};

export function useReadReceipts(
  room: YRoom | null,
  opts?: ReadReceiptsOptions,
): ReadReceiptsApi {
  const mapName = opts?.mapName ?? "mesh:receipts";
  const [allEntries, setAllEntries] = useState<ReadonlyArray<[string, number]>>(EMPTY);

  useEffect(() => {
    if (!room) {
      setAllEntries(EMPTY);
      return;
    }
    const map = room.doc.getMap<number>(mapName);
    const refresh = () => setAllEntries(Array.from(map.entries()));
    refresh();
    map.observe(refresh);
    return () => map.unobserve(refresh);
  }, [room, mapName]);

  const peerId = room?.peerId ?? "";
  const map = room ? room.doc.getMap<number>(mapName) : null;

  const mine = useMemo(() => {
    if (!map) return 0;
    return map.get(peerId) ?? 0;
  }, [map, peerId, allEntries]);

  const receipts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [pid, v] of allEntries) {
      if (pid === peerId) continue;
      if (typeof v === "number" && Number.isFinite(v)) out[pid] = v;
    }
    return out;
  }, [allEntries, peerId]);

  const markSeen = useCallback(
    (index: number) => {
      if (!room || !map || !Number.isFinite(index)) return;
      const prev = map.get(peerId) ?? 0;
      if (index <= prev) return;
      map.set(peerId, index);
    },
    [room, map, peerId],
  );

  const readersOf = useCallback(
    (index: number): string[] => {
      const out: string[] = [];
      for (const [pid, v] of allEntries) {
        if (pid === peerId) continue;
        if (typeof v === "number" && v >= index) out.push(pid);
      }
      return out;
    },
    [allEntries, peerId],
  );

  return { mine, receipts, markSeen, readersOf };
}

const EMPTY: ReadonlyArray<[string, number]> = [];
