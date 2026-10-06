import { useCallback, useEffect, useRef, useState } from "react";

export type MediaRoomStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type MediaRoomPeer = {
  peerId: string;
  displayName?: string;
};

export type MediaRoomEvent =
  | { type: "status"; status: Exclude<MediaRoomStatus, "disconnected"> }
  | { type: "peer"; peer: MediaRoomPeer; connected: boolean }
  | { type: "stream"; peerId: string; stream: MediaStream | null }
  | { type: "error"; error: Error };

export type MediaRoomJoinOptions = {
  roomId: string;
  peerId: string;
  iceServers?: readonly RTCIceServer[];
};

/** A transport owns signaling, peer connections or SFU clients, and their cleanup. */
export type MediaRoomSession = {
  publish: (stream: MediaStream) => Promise<void>;
  unpublish: () => Promise<void>;
  close: () => void | Promise<void>;
  subscribe: (listener: (event: MediaRoomEvent) => void) => () => void;
};

/** Implement this with the app's chosen WebRTC signaling or SFU transport. */
export type MediaRoomTransport = {
  join: (options: MediaRoomJoinOptions) => Promise<MediaRoomSession>;
};

export type UseMediaRoomOptions = MediaRoomJoinOptions & {
  transport: MediaRoomTransport | null;
};

export type MediaRoomState = {
  status: MediaRoomStatus;
  peers: Map<string, MediaRoomPeer>;
  streams: Map<string, MediaStream>;
  error: Error | null;
  join: () => Promise<boolean>;
  publish: (stream: MediaStream) => Promise<boolean>;
  unpublish: () => Promise<boolean>;
  leave: () => Promise<void>;
};

/**
 * Owns a live media session while leaving signaling and media routing to an
 * injected transport. Joining is always explicit; changing rooms and unmounting
 * close the old session. Capture remains the caller's responsibility.
 */
export function useMediaRoom(options: UseMediaRoomOptions): MediaRoomState {
  const { roomId, peerId, iceServers, transport } = options;
  const sessionRef = useRef<MediaRoomSession | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const joinVersion = useRef(0);
  const [status, setStatus] = useState<MediaRoomStatus>("disconnected");
  const [peers, setPeers] = useState<Map<string, MediaRoomPeer>>(() => new Map());
  const [streams, setStreams] = useState<Map<string, MediaStream>>(() => new Map());
  const [error, setError] = useState<Error | null>(null);

  const leave = useCallback(async () => {
    joinVersion.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setStatus("disconnected");
    setPeers(new Map());
    setStreams(new Map());
    setError(null);
    try {
      await session?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Media room could not close cleanly."));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    setStatus("disconnected");
    setPeers(new Map());
    setStreams(new Map());
    setError(null);
    return () => {
      joinVersion.current += 1;
      const session = sessionRef.current;
      sessionRef.current = null;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      if (session) void session.close();
    };
  }, [roomId, peerId]);

  const join = useCallback(async () => {
    if (!transport || !roomId || !peerId) {
      setError(new Error("A media transport, room ID, and peer ID are required."));
      setStatus("error");
      return false;
    }
    await leave();
    const version = ++joinVersion.current;
    setError(null);
    setStatus("connecting");
    let openedSession: MediaRoomSession | null = null;
    try {
      const session = await transport.join({ roomId, peerId, iceServers });
      openedSession = session;
      if (joinVersion.current !== version) {
        await session.close();
        return false;
      }
      sessionRef.current = session;
      unsubscribeRef.current = session.subscribe((event) => {
        if (sessionRef.current !== session) return;
        if (event.type === "status") setStatus(event.status);
        if (event.type === "error") {
          setError(event.error);
          setStatus("error");
        }
        if (event.type === "peer") {
          setPeers((current) => {
            const next = new Map(current);
            if (event.connected) next.set(event.peer.peerId, event.peer);
            else next.delete(event.peer.peerId);
            return next;
          });
          if (!event.connected) {
            setStreams((current) => {
              if (!current.has(event.peer.peerId)) return current;
              const next = new Map(current);
              next.delete(event.peer.peerId);
              return next;
            });
          }
        }
        if (event.type === "stream") {
          setStreams((current) => {
            const next = new Map(current);
            if (event.stream) next.set(event.peerId, event.stream);
            else next.delete(event.peerId);
            return next;
          });
        }
      });
      setStatus("connected");
      return true;
    } catch (cause) {
      if (openedSession) {
        if (sessionRef.current === openedSession) sessionRef.current = null;
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        try {
          await openedSession.close();
        } catch {
          // Preserve the original join/subscription error.
        }
      }
      if (joinVersion.current === version) {
        setError(cause instanceof Error ? cause : new Error("Media room join failed."));
        setStatus("error");
      }
      return false;
    }
  }, [iceServers, leave, peerId, roomId, transport]);

  const publish = useCallback(async (stream: MediaStream) => {
    const session = sessionRef.current;
    if (!session) return false;
    try {
      await session.publish(stream);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Media publish failed."));
      setStatus("error");
      return false;
    }
  }, []);

  const unpublish = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return false;
    try {
      await session.unpublish();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Media unpublish failed."));
      setStatus("error");
      return false;
    }
  }, []);

  return { status, peers, streams, error, join, publish, unpublish, leave };
}
