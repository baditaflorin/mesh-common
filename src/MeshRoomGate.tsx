import { useCallback, useId, useState, type ReactNode } from "react";
import type { NetworkOnlineState } from "./useNetworkOnline";
import type { RoomLifecycle } from "./useRoomLifecycle";
import {
  useRoomDiagnostics,
  type RoomDiagnosticStatus,
  type RoomDiagnostics,
  type RoomDiagnosticsOptions,
} from "./useRoomDiagnostics";
import type { YRoom } from "./useYRoom";

export type MeshRoomGateRenderState = Omit<RoomDiagnostics, "retry"> & {
  /** Invokes the gate's retry handler and tracks its pending state. */
  retry: () => Promise<boolean>;
  retrying: boolean;
};

export type MeshRoomGateFallback =
  ReactNode | ((state: MeshRoomGateRenderState) => ReactNode);

export type MeshRoomGateProps = {
  room: YRoom | null;
  /** Reuse diagnostics already created by the application. */
  diagnostics?: RoomDiagnostics;
  /** Optional app-owned lifecycle and network inputs for the internal diagnostics hook. */
  lifecycle?: RoomLifecycle;
  network?: NetworkOnlineState;
  diagnosticsOptions?: Omit<RoomDiagnosticsOptions, "lifecycle" | "network">;
  /** Rendered only when the room is connected. A render function receives diagnostics. */
  children?: ReactNode | ((state: MeshRoomGateRenderState) => ReactNode);
  /**
   * Fully controls every state (including `connected`) for headless use.
   * Prefer this over a bespoke room-state branch in application code.
   */
  render?: (state: MeshRoomGateRenderState) => ReactNode;
  /** Optional state-specific replacement for the standard accessible UI. */
  fallbacks?: Partial<
    Record<Exclude<RoomDiagnosticStatus, "connected">, MeshRoomGateFallback>
  >;
  /** Overrides the diagnostics reconnect action, e.g. to also refresh a token. */
  onRetry?: () => boolean | void | Promise<boolean | void>;
  title?: string;
  className?: string;
};

const defaultTitles: Record<
  Exclude<RoomDiagnosticStatus, "connected">,
  string
> = {
  loading: "Preparing room",
  connecting: "Connecting room",
  reconnecting: "Reconnecting room",
  stale: "Room connection is delayed",
  offline: "You appear to be offline",
  error: "Room connection needs attention",
};

function renderFallback(
  fallback: MeshRoomGateFallback | undefined,
  state: MeshRoomGateRenderState,
): ReactNode | undefined {
  return typeof fallback === "function" ? fallback(state) : fallback;
}

/**
 * A consistent connection boundary for mesh apps.
 *
 * It never hides the recovery path behind an automatic retry loop: users see
 * what is happening, can retry when the provider supports it, and apps may
 * replace all rendering through `render` when they need a custom layout.
 */
export function MeshRoomGate({
  room,
  diagnostics: suppliedDiagnostics,
  lifecycle,
  network,
  diagnosticsOptions,
  children,
  render,
  fallbacks,
  onRetry,
  title,
  className,
}: MeshRoomGateProps) {
  const internalDiagnostics = useRoomDiagnostics(room, {
    ...diagnosticsOptions,
    lifecycle,
    network,
  });
  const diagnostics = suppliedDiagnostics ?? internalDiagnostics;
  const [retrying, setRetrying] = useState(false);
  const titleId = useId();

  const retry = useCallback(async (): Promise<boolean> => {
    if (retrying) return false;
    setRetrying(true);
    try {
      const result = onRetry ? await onRetry() : diagnostics.retry();
      return result !== false;
    } catch {
      // `useRoomDiagnostics` surfaces provider errors. For app-owned retry
      // handlers, retain an honest false result rather than throwing from a
      // user-operated button.
      return false;
    } finally {
      setRetrying(false);
    }
  }, [diagnostics, onRetry, retrying]);

  const state: MeshRoomGateRenderState = { ...diagnostics, retry, retrying };
  if (render) return <>{render(state)}</>;

  if (diagnostics.status === "connected") {
    return <>{typeof children === "function" ? children(state) : children}</>;
  }

  const replacement = renderFallback(fallbacks?.[diagnostics.status], state);
  if (replacement !== undefined) return <>{replacement}</>;

  const canShowRetry = diagnostics.canRetry && diagnostics.status !== "offline";
  return (
    <section
      className={`mesh-room-gate mesh-room-gate-${diagnostics.status} ${className ?? ""}`}
      data-state={diagnostics.status}
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <h2 id={titleId}>{title ?? defaultTitles[diagnostics.status]}</h2>
      <p>{diagnostics.detail}</p>
      {canShowRetry ? (
        <button
          type="button"
          className="mesh-btn mesh-btn-primary"
          onClick={() => void retry()}
          disabled={retrying}
        >
          {retrying ? "Reconnecting…" : "Reconnect room"}
        </button>
      ) : null}
    </section>
  );
}
