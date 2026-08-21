import type { ReactNode } from "react";

export type MeshPermissionGateProps = {
  capability: string;
  supported?: boolean;
  pending?: boolean;
  error?: string | null;
  onRequest: () => void | Promise<void>;
  children?: ReactNode;
  fallback?: ReactNode;
  requestLabel?: string;
};

/** Accessible, app-neutral capability request gate with an explicit fallback slot. */
export function MeshPermissionGate({
  capability, supported = true, pending = false, error, onRequest, children, fallback, requestLabel,
}: MeshPermissionGateProps) {
  if (!supported) return <>{fallback ?? <p role="status">{capability} is not supported on this device.</p>}</>;
  return (
    <section className="mesh-permission-gate" aria-label={`${capability} permission`}>
      <p>{`Enable ${capability} to use this feature.`}</p>
      <button type="button" className="mesh-btn mesh-btn-primary" onClick={() => void onRequest()} disabled={pending}>
        {pending ? "Requesting…" : requestLabel ?? `Enable ${capability}`}
      </button>
      {error && <p role="alert">{error}</p>}
      {children}
    </section>
  );
}
