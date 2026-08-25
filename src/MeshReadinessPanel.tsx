import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { MeshCapabilitySnapshot } from "./MeshCapabilityGate";
import { useOptionalMeshApp } from "./MeshAppProvider";
import type { NetworkOnlineState } from "./useNetworkOnline";
import type { RoomLifecycle } from "./useRoomLifecycle";
import {
  useRoomDiagnostics,
  type RoomDiagnostics,
  type RoomDiagnosticsOptions,
} from "./useRoomDiagnostics";
import type { YRoom } from "./useYRoom";

export type MeshPeerReadiness = {
  /** Count includes the local session when using the component default. */
  current?: number;
  /** Minimum live sessions required before an action may start. */
  minimum: number;
  /** Singular noun for a participant, e.g. "player". Default: "session". */
  noun?: string;
};

export type MeshReadinessPanelProps = {
  room?: YRoom | null;
  diagnostics?: RoomDiagnostics;
  lifecycle?: RoomLifecycle;
  network?: NetworkOnlineState;
  diagnosticsOptions?: Omit<RoomDiagnosticsOptions, "lifecycle" | "network">;
  /** Output from `MeshCapabilityGate` or an app-owned equivalent. */
  capabilities?: readonly Pick<
    MeshCapabilitySnapshot,
    "id" | "label" | "required" | "status"
  >[];
  /** Omit when the feature has no armed/prepared state. */
  armed?: boolean;
  armedLabel?: string;
  peers?: MeshPeerReadiness;
  onRetry?: () => boolean | void;
  action?: ReactNode;
  className?: string;
};

type ReadinessRow = {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
};

function sessionLabel(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/**
 * A compact, honest pre-flight checklist for group interactions.
 *
 * It intentionally describes peers as live sessions rather than devices:
 * browser tabs and different browsers on a single phone are independent
 * WebRTC sessions and cannot be reliably collapsed into physical phones.
 */
export function MeshReadinessPanel({
  room: suppliedRoom,
  diagnostics: suppliedDiagnostics,
  lifecycle,
  network,
  diagnosticsOptions,
  capabilities = [],
  armed,
  armedLabel = "Feature armed",
  peers,
  onRetry,
  action,
  className,
}: MeshReadinessPanelProps) {
  const app = useOptionalMeshApp();
  const room = suppliedRoom ?? app?.room ?? null;
  const internalDiagnostics = useRoomDiagnostics(room, {
    ...diagnosticsOptions,
    lifecycle: lifecycle ?? app?.lifecycle,
    network: network ?? app?.network,
  });
  const diagnostics = suppliedDiagnostics ?? internalDiagnostics;
  const [retrying, setRetrying] = useState(false);
  const sessionCount = peers?.current ?? (room ? room.peerCount + 1 : 0);
  const minimumSessions = peers?.minimum;
  const noun = peers?.noun ?? "session";

  const rows = useMemo<ReadinessRow[]>(() => {
    const next: ReadinessRow[] = [
      {
        id: "connection",
        label: "Shared room",
        ready: diagnostics.status === "connected",
        detail: diagnostics.detail,
      },
    ];
    for (const capability of capabilities) {
      if (!capability.required) continue;
      next.push({
        id: `capability:${capability.id}`,
        label: capability.label,
        ready: capability.status === "ready",
        detail:
          capability.status === "ready"
            ? "Ready"
            : capability.status.replaceAll("-", " "),
      });
    }
    if (armed !== undefined) {
      next.push({
        id: "armed",
        label: armedLabel,
        ready: armed,
        detail: armed ? "Ready" : "Not armed yet",
      });
    }
    if (minimumSessions !== undefined) {
      next.push({
        id: "peers",
        label: "Live sessions",
        ready: sessionCount >= minimumSessions,
        detail:
          sessionCount >= minimumSessions
            ? `${sessionLabel(sessionCount, noun)} ready`
            : `Need ${sessionLabel(minimumSessions, noun)}; ${sessionLabel(sessionCount, noun)} present`,
      });
    }
    return next;
  }, [
    armed,
    armedLabel,
    capabilities,
    diagnostics.detail,
    diagnostics.status,
    minimumSessions,
    noun,
    sessionCount,
  ]);

  const ready = rows.every((row) => row.ready);
  const retry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    try {
      const result = onRetry ? onRetry() : diagnostics.retry();
      // A `void` app callback has accepted responsibility for reconnecting.
      if (result === false) return;
    } finally {
      setRetrying(false);
    }
  }, [diagnostics, onRetry, retrying]);

  return (
    <section
      className={`mesh-readiness-panel ${ready ? "mesh-readiness-ready" : "mesh-readiness-pending"} ${className ?? ""}`}
      aria-label="Readiness checklist"
      data-ready={ready}
    >
      <div role="status" aria-live="polite">
        <strong>{ready ? "Ready to start" : "Not ready yet"}</strong>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.id} data-ready={row.ready}>
            <strong>{row.ready ? "Ready" : "Needs attention"}</strong>
            <span>{row.label}</span>
            <span>{row.detail}</span>
          </li>
        ))}
      </ul>
      {!ready && diagnostics.canRetry && diagnostics.status !== "offline" ? (
        <button
          type="button"
          className="mesh-btn mesh-btn-secondary"
          onClick={retry}
          disabled={retrying}
        >
          {retrying ? "Reconnecting…" : "Reconnect room"}
        </button>
      ) : null}
      {action}
    </section>
  );
}
