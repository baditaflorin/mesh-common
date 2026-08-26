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
  /**
   * Stable id for this browser (persisted in localStorage, survives a
   * reload), unlike `peerId` which is fresh every mount. Optional because
   * hand-built `YRoom` mocks in tests may not set it — consumers should
   * treat a missing value the same as "no device-scoped dedup available".
   */
  deviceId?: string;
  /**
   * Known other sessions in this room. This combines Yjs awareness with the
   * provider's local BroadcastChannel discovery so same-browser peers are not
   * hidden when awareness lags behind the local fallback.
   */
  peerCount: number;
  roomId: string;
};

export type PeerAwareProvider = {
  awareness?: {
    getStates: () => Map<unknown, unknown>;
    on: (event: "change", callback: () => void) => void;
    off: (event: "change", callback: () => void) => void;
  };
  /**
   * y-webrtc keeps a direct view of peers reached through BroadcastChannel.
   * `room` is intentionally read structurally: it is public on y-webrtc's
   * provider but may be null while its async key setup finishes.
   */
  room?: {
    bcConns?: { size: number };
  } | null;
  on?: (event: "peers", callback: () => void) => void;
  off?: (event: "peers", callback: () => void) => void;
};

/**
 * Awareness normally tells us about every remote session, but y-webrtc's
 * BroadcastChannel-only path can establish document sync before awareness
 * has surfaced the other tab. The provider emits `peers` for that path.
 *
 * We use the larger of BroadcastChannel discovery and awareness rather than
 * adding those views together, avoiding a double-count when awareness catches
 * up. WebRTC connection attempts are deliberately not counted here: y-webrtc
 * exposes them before a peer is actually connected, while awareness is the
 * reliable live-session source for that route.
 */
export function getKnownPeerCount(provider: PeerAwareProvider | null): number {
  const awarenessPeers = provider?.awareness
    ? Math.max(0, provider.awareness.getStates().size - 1)
    : 0;
  const broadcastChannelPeers = provider?.room?.bcConns?.size ?? 0;
  return Math.max(awarenessPeers, broadcastChannelPeers);
}

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
    let detachPeerListeners: (() => void) | null = null;

    const boot = async () => {
      await maybeFetchTurnCredentials(s);
      if (disposed || versionRef.current !== myVersion) return;

      sync = createRoomSync(config.storagePrefix, roomId, s);

      const updatePeers = () => {
        if (disposed) return;
        const provider = sync?.provider as PeerAwareProvider | null;
        const count = getKnownPeerCount(provider);
        setRoom({
          doc: sync!.doc,
          provider: sync!.provider,
          peerId: sync!.peerId,
          deviceId: sync!.deviceId,
          peerCount: count,
          roomId,
        });
      };
      updatePeers();

      const provider = sync.provider as PeerAwareProvider | null;
      const awareness = provider?.awareness;
      awareness?.on("change", updatePeers);
      provider?.on?.("peers", updatePeers);
      detachPeerListeners = () => {
        awareness?.off("change", updatePeers);
        provider?.off?.("peers", updatePeers);
      };
    };

    void boot();

    return () => {
      disposed = true;
      detachPeerListeners?.();
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
