import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type RoomLifecycleStatus = "idle" | "joining" | "connected" | "disconnected";
export type RoomLifecycle = {
  status: RoomLifecycleStatus;
  joinedAt: number | null;
  error: Error | null;
  reconnect: () => boolean;
};

type ProviderEvents = {
  connected?: boolean;
  on?: (event: "status", callback: (event: { status?: string }) => void) => void;
  off?: (event: "status", callback: (event: { status?: string }) => void) => void;
  connect?: () => void;
  disconnect?: () => void;
};

/** Normalizes the y-webrtc provider status event into UI-ready room lifecycle state. */
export function useRoomLifecycle(room: YRoom | null): RoomLifecycle {
  const provider = room?.provider as unknown as ProviderEvents | null;
  const [status, setStatus] = useState<RoomLifecycleStatus>(() => room ? (provider?.connected ? "connected" : "joining") : "idle");
  const [joinedAt, setJoinedAt] = useState<number | null>(() => provider?.connected ? Date.now() : null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!room) {
      setStatus("idle");
      setJoinedAt(null);
      return;
    }
    const update = (event: { status?: string }) => {
      const next: RoomLifecycleStatus = event.status === "connected" ? "connected" : "disconnected";
      setStatus(next);
      if (next === "connected") setJoinedAt((current) => current ?? Date.now());
    };
    setStatus(provider?.connected ? "connected" : "joining");
    if (provider?.connected) setJoinedAt(Date.now());
    provider?.on?.("status", update);
    return () => provider?.off?.("status", update);
  }, [room, provider]);

  const reconnect = useCallback(() => {
    if (!provider?.connect) return false;
    try {
      provider.disconnect?.();
      provider.connect();
      setError(null);
      setStatus("joining");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    }
  }, [provider]);

  return { status, joinedAt, error, reconnect };
}
