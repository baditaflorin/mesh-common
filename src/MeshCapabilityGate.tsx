import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  usePermission,
  type MeshPermissionState,
  type PermissionRequest,
} from "./usePermission";

export type MeshCapabilityStatus =
  | "ready"
  | "requesting"
  | "needs-permission"
  | "denied"
  | "unsupported"
  | "unknown";

export type MeshCapabilitySnapshot = {
  id: string;
  label: string;
  required: boolean;
  status: MeshCapabilityStatus;
  permission: MeshPermissionState;
  detail?: string;
  error?: Error | null;
};

export type MeshCapabilityDefinition = {
  /** Stable machine-readable key, such as `camera` or `motion`. */
  id: string;
  label: string;
  /** Permission API name. String accepts newer browser permission names. */
  permission: PermissionName | (string & {});
  required?: boolean;
  description?: ReactNode;
  /** Gesture-bound browser request, e.g. `getUserMedia`. Never called on mount. */
  request?: PermissionRequest;
  /** Force a capability unavailable when app-level feature detection says so. */
  supported?: boolean;
  /** Capability-specific fallback, normally a browser or device alternative. */
  fallback?: ReactNode | ((state: MeshCapabilitySnapshot) => ReactNode);
  /** Optional post-grant test control, such as "Test flashlight". */
  test?: ReactNode | ((state: MeshCapabilitySnapshot) => ReactNode);
};

export type MeshCapabilityGateProps = {
  capabilities: readonly MeshCapabilityDefinition[];
  title?: ReactNode;
  description?: ReactNode;
  /** Receives the aggregate state whenever a capability changes. */
  onStateChange?: (
    state: Readonly<Record<string, MeshCapabilitySnapshot>>,
  ) => void;
  /** Generic post-grant test slot when a capability does not define its own. */
  renderTest?: (state: MeshCapabilitySnapshot) => ReactNode;
  /**
   * A whole-gate fallback shown when a required capability is denied or not
   * supported. It supplements the row-level fallback rather than hiding the
   * checklist, so users still understand what is missing.
   */
  fallback?:
    | ReactNode
    | ((state: Readonly<Record<string, MeshCapabilitySnapshot>>) => ReactNode);
  className?: string;
  children?: (
    state: Readonly<Record<string, MeshCapabilitySnapshot>>,
  ) => ReactNode;
};

function isBlocked(status: MeshCapabilityStatus): boolean {
  return status === "denied" || status === "unsupported";
}

function displayStatus(status: MeshCapabilityStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "requesting":
      return "Requesting permission";
    case "needs-permission":
      return "Permission needed";
    case "denied":
      return "Permission denied";
    case "unsupported":
      return "Not supported";
    case "unknown":
      return "Permission status unavailable";
  }
}

function resolveStatus(
  permission: MeshPermissionState,
  supported: boolean,
  requesting: boolean,
): MeshCapabilityStatus {
  if (!supported || permission === "unsupported") return "unsupported";
  if (requesting) return "requesting";
  if (permission === "granted") return "ready";
  if (permission === "denied") return "denied";
  if (permission === "prompt") return "needs-permission";
  return "unknown";
}

function sameSnapshot(
  previous: MeshCapabilitySnapshot | undefined,
  next: MeshCapabilitySnapshot,
): boolean {
  return (
    previous?.label === next.label &&
    previous.required === next.required &&
    previous.status === next.status &&
    previous.permission === next.permission &&
    previous.detail === next.detail &&
    previous.error === next.error
  );
}

function MeshCapabilityRow({
  capability,
  onSnapshot,
  renderTest,
}: {
  capability: MeshCapabilityDefinition;
  onSnapshot: (snapshot: MeshCapabilitySnapshot) => void;
  renderTest?: (state: MeshCapabilitySnapshot) => ReactNode;
}) {
  const permission = usePermission(
    capability.permission as PermissionName,
    capability.request,
  );
  const [requesting, setRequesting] = useState(false);
  const supported = capability.supported ?? permission.supported;
  const status = resolveStatus(permission.state, supported, requesting);
  const snapshot = useMemo<MeshCapabilitySnapshot>(
    () => ({
      id: capability.id,
      label: capability.label,
      required: capability.required ?? true,
      status,
      permission: permission.state,
      error: permission.error,
    }),
    [
      capability.id,
      capability.label,
      capability.required,
      permission.error,
      permission.state,
      status,
    ],
  );

  useEffect(() => onSnapshot(snapshot), [onSnapshot, snapshot]);

  const request = useCallback(async () => {
    if (!supported || requesting) return false;
    setRequesting(true);
    try {
      return await permission.request();
    } finally {
      setRequesting(false);
    }
  }, [permission, requesting, supported]);

  const fallback =
    typeof capability.fallback === "function"
      ? capability.fallback(snapshot)
      : capability.fallback;
  const test = capability.test ?? renderTest;

  return (
    <li
      className={`mesh-capability-row mesh-capability-${status}`}
      data-capability={capability.id}
      data-state={status}
    >
      <div className="mesh-capability-row-main">
        <strong>{capability.label}</strong>
        {capability.required === false ? (
          <span>Optional</span>
        ) : (
          <span>Required</span>
        )}
        <span role="status">{displayStatus(status)}</span>
      </div>
      {capability.description ? (
        <div className="mesh-capability-description">
          {capability.description}
        </div>
      ) : null}
      {status !== "ready" && status !== "unsupported" ? (
        <button
          type="button"
          className="mesh-btn mesh-btn-primary"
          onClick={() => void request()}
          disabled={requesting || !supported}
        >
          {requesting ? "Requesting…" : `Enable ${capability.label}`}
        </button>
      ) : null}
      {permission.error ? <p role="alert">{permission.error.message}</p> : null}
      {isBlocked(status) && fallback ? (
        <div className="mesh-capability-fallback">{fallback}</div>
      ) : null}
      {status === "ready" && test ? (
        <div className="mesh-capability-test">
          {typeof test === "function" ? test(snapshot) : test}
        </div>
      ) : null}
    </li>
  );
}

/**
 * A permission checklist for a feature that needs more than one capability.
 *
 * Unlike a stack of one-off permission dialogs, this makes readiness and
 * browser fallbacks visible up front while preserving user-gesture-only
 * requests. It is safe to mount before any request callback is available.
 */
export function MeshCapabilityGate({
  capabilities,
  title = "Device readiness",
  description,
  onStateChange,
  renderTest,
  fallback,
  className,
  children,
}: MeshCapabilityGateProps) {
  const [snapshots, setSnapshots] = useState<
    Record<string, MeshCapabilitySnapshot>
  >({});
  const report = useCallback((snapshot: MeshCapabilitySnapshot) => {
    setSnapshots((current) =>
      sameSnapshot(current[snapshot.id], snapshot)
        ? current
        : { ...current, [snapshot.id]: snapshot },
    );
  }, []);

  // Drop state for capabilities no longer rendered. This protects callers who
  // switch a feature mode without retaining an obsolete blocked requirement.
  useEffect(() => {
    const allowed = new Set(capabilities.map((capability) => capability.id));
    setSnapshots((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([id]) => allowed.has(id)),
      ) as Record<string, MeshCapabilitySnapshot>;
      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
  }, [capabilities]);

  useEffect(() => {
    onStateChange?.(snapshots);
  }, [onStateChange, snapshots]);

  const requiredBlocked = Object.values(snapshots).some(
    (snapshot) => snapshot.required && isBlocked(snapshot.status),
  );
  const resolvedFallback =
    typeof fallback === "function" ? fallback(snapshots) : fallback;

  return (
    <section
      className={`mesh-capability-gate ${className ?? ""}`}
      aria-label="Device capabilities"
    >
      <h2>{title}</h2>
      {description ? (
        <div className="mesh-capability-gate-description">{description}</div>
      ) : null}
      <ul className="mesh-capability-list">
        {capabilities.map((capability) => (
          <MeshCapabilityRow
            key={capability.id}
            capability={capability}
            onSnapshot={report}
            renderTest={renderTest}
          />
        ))}
      </ul>
      {requiredBlocked && resolvedFallback ? (
        <div className="mesh-capability-gate-fallback">{resolvedFallback}</div>
      ) : null}
      {children?.(snapshots)}
    </section>
  );
}
