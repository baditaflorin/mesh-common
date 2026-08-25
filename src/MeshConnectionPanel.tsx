import { useCallback, useState } from "react";
import type { NetworkOnlineState } from "./useNetworkOnline";
import {
  useNetworkQuality,
  type NetworkQualityOptions,
} from "./useNetworkQuality";
import type { RoomLifecycle } from "./useRoomLifecycle";
import {
  useRoomDiagnostics,
  type RoomDiagnostics,
  type RoomDiagnosticsOptions,
} from "./useRoomDiagnostics";
import type { YRoom } from "./useYRoom";

export type MeshConnectionPanelProps = {
  room: YRoom | null;
  diagnostics?: RoomDiagnostics;
  lifecycle?: RoomLifecycle;
  network?: NetworkOnlineState;
  diagnosticsOptions?: Omit<RoomDiagnosticsOptions, "lifecycle" | "network">;
  qualityOptions?: NetworkQualityOptions;
  /** A compact panel starts closed to avoid overwhelming a first-use screen. */
  defaultDetailsOpen?: boolean;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  showRoomId?: boolean;
  className?: string;
};

function statusLabel(status: RoomDiagnostics["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "loading":
      return "Preparing";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "stale":
      return "Delayed";
    case "offline":
      return "Offline";
    case "error":
      return "Needs attention";
  }
}

/**
 * Progressive-disclosure room diagnostics with an explicit reconnect action.
 *
 * This deliberately calls counts "live sessions", not phones: a phone can
 * legitimately have Safari, Chrome, or multiple tabs connected at once.
 */
export function MeshConnectionPanel({
  room,
  diagnostics: suppliedDiagnostics,
  lifecycle,
  network,
  diagnosticsOptions,
  qualityOptions,
  defaultDetailsOpen = false,
  detailsOpen,
  onDetailsOpenChange,
  showRoomId = false,
  className,
}: MeshConnectionPanelProps) {
  const internalDiagnostics = useRoomDiagnostics(room, {
    ...diagnosticsOptions,
    lifecycle,
    network,
  });
  const diagnostics = suppliedDiagnostics ?? internalDiagnostics;
  const quality = useNetworkQuality(room, qualityOptions);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultDetailsOpen);
  const [retrying, setRetrying] = useState(false);
  const open = detailsOpen ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (detailsOpen === undefined) setUncontrolledOpen(next);
      onDetailsOpenChange?.(next);
    },
    [detailsOpen, onDetailsOpenChange],
  );

  const retry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    try {
      diagnostics.retry();
    } finally {
      // `retry()` initiates an asynchronous provider operation but is itself
      // synchronous. Re-enable after this gesture; duplicate clicks are still
      // blocked during the event and lifecycle state communicates progress.
      setRetrying(false);
    }
  }, [diagnostics, retrying]);

  const sessions = room ? room.peerCount + 1 : 0;
  const rows: Array<[string, string]> = [
    ["Network", diagnostics.network.online ? "Reachable" : "Unavailable"],
    ["Network signal", diagnostics.network.why.replaceAll("-", " ")],
    ["Room", diagnostics.detail],
    [
      "Signaling",
      diagnostics.providerConnected === null
        ? "Local or test room"
        : diagnostics.providerConnected
          ? "Connected"
          : "Not connected",
    ],
    ["Live sessions", sessions === 1 ? "1 session" : `${sessions} sessions`],
  ];
  if (quality.median > 0)
    rows.push(["Peer latency", `${Math.round(quality.median)} ms median`]);
  if (diagnostics.retryAttempts > 0) {
    rows.push(["Reconnect attempts", String(diagnostics.retryAttempts)]);
  }
  if (showRoomId && room) rows.push(["Room ID", room.roomId]);

  return (
    <section
      className={`mesh-connection-panel mesh-connection-panel-${diagnostics.status} ${className ?? ""}`}
      data-state={diagnostics.status}
      aria-label="Connection diagnostics"
    >
      <div
        className="mesh-connection-panel-summary"
        role="status"
        aria-live="polite"
      >
        <strong>{statusLabel(diagnostics.status)}</strong>
        <span>{diagnostics.detail}</span>
      </div>
      {diagnostics.canRetry &&
      diagnostics.status !== "connected" &&
      diagnostics.status !== "offline" ? (
        <button
          type="button"
          className="mesh-btn mesh-btn-secondary"
          onClick={retry}
          disabled={retrying}
        >
          {retrying ? "Reconnecting…" : "Reconnect room"}
        </button>
      ) : null}
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>Connection details</summary>
        <dl>
          {rows.map(([term, description]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
