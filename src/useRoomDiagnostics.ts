import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  NetworkOnlineOptions,
  NetworkOnlineState,
} from "./useNetworkOnline";
import { useNetworkOnline } from "./useNetworkOnline";
import type { RoomLifecycle } from "./useRoomLifecycle";
import { useRoomLifecycle } from "./useRoomLifecycle";
import type { YRoom } from "./useYRoom";

export type RoomDiagnosticStatus =
  | "loading"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stale"
  | "offline"
  | "error";

export type RoomDiagnostics = {
  status: RoomDiagnosticStatus;
  /** A short, user-facing explanation suitable for a status surface. */
  detail: string;
  network: NetworkOnlineState;
  lifecycle: RoomLifecycle;
  /** `null` means the room is local/test-only and has no signaling provider. */
  providerConnected: boolean | null;
  /** The most recent provider status event observed by this hook. */
  lastStatusAt: number | null;
  /** When the current connecting/reconnecting period began. */
  waitingSince: number | null;
  /** Number of manual reconnect requests in the current room instance. */
  retryAttempts: number;
  /** The most recent manual reconnect request. */
  lastRetryAt: number | null;
  error: Error | null;
  canRetry: boolean;
  isStale: boolean;
  /** Best-effort signaling reconnect. Returns false when no retry is possible. */
  retry: () => boolean;
};

export type RoomDiagnosticsOptions = {
  /** Reuse an application-owned network probe instead of starting another one. */
  network?: NetworkOnlineState;
  /** Reuse an application-owned lifecycle observer. */
  lifecycle?: RoomLifecycle;
  networkOptions?: NetworkOnlineOptions;
  /**
   * How long a connection may remain in joining/reconnecting before it is
   * marked stale. Default: 12 seconds. A connected idle room is never marked
   * stale merely because no status event arrived.
   */
  staleAfterMs?: number;
  /** Injectable for deterministic tests and apps with a shared clock. */
  now?: () => number;
};

type ProviderEvents = {
  connected?: boolean;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  off?: (event: string, callback: (...args: unknown[]) => void) => void;
  connect?: () => void;
};

const DEFAULT_STALE_AFTER_MS = 12_000;

function asError(value: unknown, fallback: string): Error {
  return value instanceof Error
    ? value
    : new Error(typeof value === "string" ? value : fallback);
}

/**
 * Adds UI-ready diagnostics on top of `useRoomLifecycle`.
 *
 * `useRoomLifecycle` intentionally remains a small provider-status adapter.
 * This hook layers network availability, provider errors, manual retry
 * attempts, and a timeout for a room that gets stuck while joining. It does
 * not infer that an otherwise healthy, quiet room is stale.
 */
export function useRoomDiagnostics(
  room: YRoom | null,
  options?: RoomDiagnosticsOptions,
): RoomDiagnostics {
  const staleAfterMs = Math.max(
    0,
    options?.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
  );
  const clockSource = options?.now ?? Date.now;
  const nowRef = useRef(clockSource);
  nowRef.current = clockSource;
  // Keep effect dependencies stable even when a caller provides an inline
  // clock callback. The current callback is still read on every invocation.
  const now = useCallback(() => nowRef.current(), []);
  // Keep both hooks unconditional. When an app already owns the network
  // signal, diagnostics must not start a redundant external reachability
  // probe merely to discard its result; use the passive hook path instead.
  const detectedNetwork = useNetworkOnline(
    options?.network ? { probeUrl: false } : options?.networkOptions,
  );
  const detectedLifecycle = useRoomLifecycle(room);
  const network = options?.network ?? detectedNetwork;
  const lifecycle = options?.lifecycle ?? detectedLifecycle;
  const provider = room?.provider as unknown as ProviderEvents | null;
  // `useYRoom` publishes a fresh wrapper when peer awareness changes. The
  // underlying document/provider is the room identity; use it for reset
  // boundaries so a new peer cannot erase a user's retry history or postpone
  // stale detection.
  const roomDocument = room?.doc ?? null;

  const [providerError, setProviderError] = useState<Error | null>(null);
  const [lastStatusAt, setLastStatusAt] = useState<number | null>(null);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [lastRetryAt, setLastRetryAt] = useState<number | null>(null);
  const [, setStaleTick] = useState(0);

  // Reset per-room diagnostics only after the underlying room identity
  // changes, not after a peer-count wrapper update.
  useEffect(() => {
    setProviderError(null);
    setRetryAttempts(0);
    setLastRetryAt(null);
    if (!room || !provider) {
      setLastStatusAt(null);
      setWaitingSince(null);
      return;
    }
    const at = now();
    setLastStatusAt(provider.connected ? at : null);
    setWaitingSince(provider.connected ? null : at);
  }, [now, provider, room?.roomId, roomDocument]);

  useEffect(() => {
    if (!provider) return;
    const onStatus = (event?: unknown) => {
      const status =
        event && typeof event === "object" && "status" in event
          ? (event as { status?: unknown }).status
          : undefined;
      const at = now();
      setLastStatusAt(at);
      if (status === "connected") {
        setProviderError(null);
        setWaitingSince(null);
      } else {
        setWaitingSince((current) => current ?? at);
      }
    };
    const onError = (cause?: unknown) => {
      const at = now();
      setLastStatusAt(at);
      setProviderError(asError(cause, "The room provider reported an error"));
    };
    provider.on?.("status", onStatus);
    provider.on?.("error", onError);
    return () => {
      provider.off?.("status", onStatus);
      provider.off?.("error", onError);
    };
  }, [now, provider]);

  // The lifecycle hook is authoritative for its status. Keep an explicit
  // timestamp for the in-progress period so `stale` means "still trying too
  // long", rather than "the provider has been quietly connected for a while".
  useEffect(() => {
    if (!roomDocument || !provider || lifecycle.status === "connected") {
      setWaitingSince(null);
      return;
    }
    setWaitingSince((current) => current ?? now());
  }, [lifecycle.status, now, provider, roomDocument]);

  useEffect(() => {
    if (
      !roomDocument ||
      !provider ||
      !network.online ||
      lifecycle.status === "connected" ||
      providerError
    ) {
      return;
    }
    const started = waitingSince ?? now();
    const elapsed = Math.max(0, now() - started);
    // Once stale, keep the state until a provider/network transition changes
    // it. Re-arming a 1 ms timeout here would cause an idle render loop.
    if (elapsed >= staleAfterMs) return;
    const timer = setTimeout(
      () => setStaleTick((tick) => tick + 1),
      staleAfterMs - elapsed,
    );
    return () => clearTimeout(timer);
  }, [
    lifecycle.status,
    network.online,
    now,
    provider,
    providerError,
    roomDocument,
    staleAfterMs,
    waitingSince,
  ]);

  const retry = useCallback(() => {
    if (!room || !provider?.connect) return false;
    const at = now();
    setProviderError(null);
    setLastRetryAt(at);
    setRetryAttempts((attempts) => attempts + 1);
    setWaitingSince(at);
    const accepted = lifecycle.reconnect();
    if (!accepted) {
      setProviderError(
        lifecycle.error ?? new Error("The room could not start reconnecting"),
      );
    }
    return accepted;
  }, [lifecycle, now, provider?.connect, room]);

  return useMemo(() => {
    const error = providerError ?? lifecycle.error;
    const elapsed =
      waitingSince === null ? 0 : Math.max(0, now() - waitingSince);
    const isStale =
      Boolean(
        room &&
        provider &&
        network.online &&
        !error &&
        lifecycle.status !== "connected",
      ) && elapsed >= staleAfterMs;
    const reconnecting =
      lastRetryAt !== null || lifecycle.status === "disconnected";
    let status: RoomDiagnosticStatus;
    let detail: string;

    if (!room) {
      status = "loading";
      detail = "Preparing the shared room.";
    } else if (!network.online) {
      status = "offline";
      detail =
        "This device appears to be offline. Check its network, VPN, or captive portal.";
    } else if (error) {
      status = "error";
      detail = error.message || "The room connection encountered an error.";
    } else if (!provider || lifecycle.status === "connected") {
      status = "connected";
      detail = provider
        ? "The shared room is connected."
        : "The local room is ready.";
    } else if (isStale) {
      status = "stale";
      detail =
        "The room is taking longer than expected to connect. Try reconnecting.";
    } else if (reconnecting) {
      status = "reconnecting";
      detail = "Reconnecting the shared room.";
    } else {
      status = "connecting";
      detail = "Connecting to the shared room.";
    }

    return {
      status,
      detail,
      network,
      lifecycle,
      providerConnected: provider ? Boolean(provider.connected) : null,
      lastStatusAt,
      waitingSince,
      retryAttempts,
      lastRetryAt,
      error,
      canRetry: Boolean(room && provider?.connect),
      isStale,
      retry,
    };
  }, [
    clockSource,
    lastRetryAt,
    lastStatusAt,
    lifecycle,
    network,
    now,
    provider,
    providerError,
    retry,
    retryAttempts,
    room,
    staleAfterMs,
    waitingSince,
  ]);
}
