import { useEffect, useMemo, useRef, useState } from "react";
import type { WebrtcProvider } from "y-webrtc";
import type * as Y from "yjs";
import type { MeshConfig } from "./MeshConfig";
import { iceStorage, maybeFetchTurnCredentials } from "./iceConfig";
import { createRoomSync } from "./yjsRoom";

export type YRoom = {
  doc: Y.Doc;
  provider: WebrtcProvider | null;
  peerId: string;
  peerCount: number;
  roomId: string;
};

/**
 * Bootstraps a Yjs WebRTC room for the given config + roomId.
 *
 * - Fetches TURN credentials on mount (best-effort; STUN-only fallback).
 * - Destroys + recreates the provider when roomId changes.
 * - Tracks live peer count via the awareness `change` event.
 *
 * Each app holds the Y.Doc and pulls Y.Map / Y.Array shapes off it as needed.
 */
export function useYRoom(config: MeshConfig, roomId: string): YRoom | null {
  const [room, setRoom] = useState<YRoom | null>(null);
  const versionRef = useRef(0);

  const s = useMemo(
    () =>
      iceStorage(config.storagePrefix, {
        signalingUrl: config.signalingUrl,
        turnTokenUrl: config.turnTokenUrl,
      }),
    [config.storagePrefix, config.signalingUrl, config.turnTokenUrl],
  );

  useEffect(() => {
    let disposed = false;
    const myVersion = ++versionRef.current;
    let sync: ReturnType<typeof createRoomSync> | null = null;

    const boot = async () => {
      await maybeFetchTurnCredentials(s);
      if (disposed || versionRef.current !== myVersion) return;

      sync = createRoomSync(config.storagePrefix, roomId, s);

      const updatePeers = () => {
        if (disposed) return;
        const aw = (
          sync?.provider as unknown as {
            awareness?: { getStates: () => Map<number, unknown> };
          } | null
        )?.awareness;
        const count = aw ? Math.max(0, aw.getStates().size - 1) : 0;
        setRoom({
          doc: sync!.doc,
          provider: sync!.provider,
          peerId: sync!.peerId,
          peerCount: count,
          roomId,
        });
      };
      updatePeers();

      const aw = (
        sync.provider as unknown as {
          awareness?: { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void };
        } | null
      )?.awareness;
      if (aw) {
        aw.on("change", updatePeers);
      }
    };

    void boot();

    return () => {
      disposed = true;
      try {
        sync?.provider?.destroy();
        sync?.doc.destroy();
      } catch {
        // ignore teardown errors
      }
    };
  }, [config.storagePrefix, roomId, s]);

  return room;
}
