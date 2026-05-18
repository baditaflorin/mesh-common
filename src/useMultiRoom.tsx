import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import type { MeshConfig } from "./MeshConfig";
import { iceStorage, maybeFetchTurnCredentials } from "./iceConfig";
import { createRoomSync } from "./yjsRoom";
import type { YRoom } from "./useYRoom";

/**
 * Manage *several* Yjs WebRTC rooms in one browser tab. The active room is
 * what `Feature` should render; the rest stay synced in the background so
 * switching is instant.
 *
 * Each room runs its own WebrtcProvider and Y.Doc — there is no cross-room
 * data leak. The identity (Ed25519 keypair) is per-app via `useIdentity` and
 * is shared across rooms automatically.
 *
 *   const tabs = useMultiRoom(config, ["alpha", "beta"]);
 *   tabs.add("gamma");
 *   tabs.setActive("beta");
 *   <Feature room={tabs.active} />
 *   <TabStrip rooms={tabs.rooms} active={tabs.activeId} onSelect={tabs.setActive} />
 *
 * Cost: one Y.Doc + one signaling subscription per room. Keep n small
 * (typically 2–4) — this is for facilitators running parallel sessions, not
 * a chat client.
 */

export type MultiRoomEntry = {
  roomId: string;
  room: YRoom | null;
  /** True iff the room has produced its first non-null YRoom (provider ready). */
  ready: boolean;
};

export type MultiRoomApi = {
  /** All rooms in declaration order. */
  rooms: MultiRoomEntry[];
  /** The currently-active room (or null until the first one boots). */
  active: YRoom | null;
  /** The currently-active room ID. */
  activeId: string | null;
  setActive: (roomId: string) => void;
  add: (roomId: string) => void;
  remove: (roomId: string) => void;
  /** Sum of peerCount across rooms — useful for "you're connected to N peers across 3 rooms" footers. */
  totalPeerCount: number;
};

type Sync = ReturnType<typeof createRoomSync>;

export function useMultiRoom(
  config: MeshConfig,
  initialRoomIds: string[],
  opts?: { initialActive?: string },
): MultiRoomApi {
  const [roomIds, setRoomIds] = useState<string[]>(() => Array.from(new Set(initialRoomIds)));
  const [activeId, setActiveId] = useState<string | null>(() => opts?.initialActive ?? initialRoomIds[0] ?? null);
  const [entries, setEntries] = useState<Record<string, YRoom | null>>({});
  const syncs = useRef<Map<string, Sync>>(new Map());

  const s = useMemo(
    () =>
      iceStorage(config.storagePrefix, {
        signalingUrl: config.signalingUrl,
        turnTokenUrl: config.turnTokenUrl,
      }),
    [config.storagePrefix, config.signalingUrl, config.turnTokenUrl],
  );

  // Effect: keep the set of live syncs in sync with `roomIds`.
  useEffect(() => {
    let disposed = false;

    const ensureRoom = async (roomId: string) => {
      if (syncs.current.has(roomId)) return;
      await maybeFetchTurnCredentials(s);
      if (disposed) return;
      const sync = createRoomSync(config.storagePrefix, roomId, s);
      syncs.current.set(roomId, sync);

      const refresh = () => {
        if (disposed) return;
        const aw = (
          sync.provider as unknown as {
            awareness?: { getStates: () => Map<number, unknown> };
          } | null
        )?.awareness;
        const peerCount = aw ? Math.max(0, aw.getStates().size - 1) : 0;
        setEntries((prev) => ({
          ...prev,
          [roomId]: {
            doc: sync.doc,
            provider: sync.provider as WebrtcProvider | null,
            peerId: sync.peerId,
            peerCount,
            roomId,
          },
        }));
      };
      refresh();

      const aw = (
        sync.provider as unknown as {
          awareness?: { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void };
        } | null
      )?.awareness;
      if (aw) {
        aw.on("change", refresh);
      }
    };

    const teardownRoom = (roomId: string) => {
      const sync = syncs.current.get(roomId);
      if (!sync) return;
      try {
        sync.provider?.destroy();
        sync.doc.destroy();
      } catch {
        // ignore teardown errors
      }
      syncs.current.delete(roomId);
      setEntries((prev) => {
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
    };

    // Boot any new rooms.
    for (const id of roomIds) void ensureRoom(id);

    // Tear down any rooms that have been removed.
    for (const id of Array.from(syncs.current.keys())) {
      if (!roomIds.includes(id)) teardownRoom(id);
    }

    return () => {
      disposed = true;
      for (const id of Array.from(syncs.current.keys())) teardownRoom(id);
    };
    // Note: include all referenced config bits so a config change re-boots.
  }, [roomIds, config.storagePrefix, s, ensureSafe(config)]);

  const setActive = useCallback((roomId: string) => {
    setActiveId(roomId);
    setRoomIds((cur) => (cur.includes(roomId) ? cur : [...cur, roomId]));
  }, []);

  const add = useCallback((roomId: string) => {
    setRoomIds((cur) => (cur.includes(roomId) ? cur : [...cur, roomId]));
  }, []);

  const remove = useCallback((roomId: string) => {
    setRoomIds((cur) => cur.filter((r) => r !== roomId));
    setActiveId((cur) => (cur === roomId ? null : cur));
  }, []);

  const rooms: MultiRoomEntry[] = roomIds.map((id) => ({
    roomId: id,
    room: entries[id] ?? null,
    ready: !!entries[id],
  }));
  const active = activeId ? entries[activeId] ?? null : null;
  const totalPeerCount = rooms.reduce((sum, r) => sum + (r.room?.peerCount ?? 0), 0);

  return { rooms, active, activeId, setActive, add, remove, totalPeerCount };
}

/** Detect-and-stringify hook for the config dep — config objects are recreated per render in many apps. */
function ensureSafe(config: MeshConfig): string {
  return `${config.signalingUrl ?? ""}|${config.turnTokenUrl ?? ""}`;
}
