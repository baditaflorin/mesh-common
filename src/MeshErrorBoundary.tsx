import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Crash containment for a mesh-* `<Feature>` tree.
 *
 * Today no mesh-* app has an error boundary, which means a single Yjs
 * observer that throws (peer wrote junk, network teardown race, etc.)
 * blanks the whole tab. Wrapping `<Feature>` with this turns that into a
 * scoped, recoverable error card with one canonical "copy diagnostics"
 * affordance that fits the honesty contract (no remote telemetry).
 *
 * Drop-in usage in any app's `App.tsx`:
 *
 *   <MeshShell …>
 *     <MeshErrorBoundary appName={config.appName} version={config.version}>
 *       <Feature room={room} config={config} />
 *     </MeshErrorBoundary>
 *   </MeshShell>
 *
 * The `mesh-codemod` (#18 from the ecosystem list) can sweep this into every
 * sibling app in one pass once the wrapper exists.
 */

export type MeshErrorBoundaryProps = {
  children: ReactNode;
  /** Human-readable app name, shown in the diagnostics blob. */
  appName?: string;
  /** Version string, included in diagnostics so reports are uniquely identifiable. */
  version?: string;
  /** Optional: render a custom fallback. Receives the error + a reset fn. */
  fallback?: (state: { error: Error; resetError: () => void }) => ReactNode;
  /** Optional: side-effect hook invoked once per error (e.g., local log ring). */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { error: Error | null; info: ErrorInfo | null };

export class MeshErrorBoundary extends Component<MeshErrorBoundaryProps, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    try {
      this.props.onError?.(error, info);
    } catch {
      // never let the handler itself crash the boundary
    }
    // Best-effort console (developers + browser devtools see it).
    console.error("[MeshErrorBoundary]", error, info);
  }

  resetError = (): void => {
    this.setState({ error: null, info: null });
  };

  buildDiagnostics(): string {
    const { error, info } = this.state;
    if (!error) return "";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "?";
    const url = typeof window !== "undefined" ? window.location.href : "?";
    const lines = [
      `# mesh-* diagnostics`,
      `app: ${this.props.appName ?? "(unknown)"}`,
      `version: ${this.props.version ?? "(unknown)"}`,
      `url: ${url}`,
      `ua: ${ua}`,
      `time: ${new Date().toISOString()}`,
      ``,
      `## error`,
      `${error.name}: ${error.message}`,
      ``,
      `## stack`,
      error.stack ?? "(no stack)",
    ];
    if (info?.componentStack) {
      lines.push("", "## component stack", info.componentStack.trim());
    }
    return lines.join("\n");
  }

  copyDiagnostics = async (): Promise<void> => {
    const text = this.buildDiagnostics();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: a hidden textarea + execCommand path. Modern browsers should
      // not hit this; we keep it tiny.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing to do */
      }
      document.body.removeChild(ta);
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, resetError: this.resetError });
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          maxWidth: 560,
          margin: "48px auto",
          padding: 20,
          background: "#fff5f5",
          color: "#5d1f1f",
          border: "1px solid #ffd0d0",
          borderRadius: 12,
          font: "14px/1.45 system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Something broke inside this room.
        </div>
        <div style={{ marginBottom: 12 }}>
          {this.props.appName ?? "The app"} hit an error and stopped rendering.
          Your local data is unchanged; refreshing should recover, and if not,
          the diagnostics below will help us fix it.
        </div>
        <div style={{ fontFamily: "ui-monospace, SF Mono, Menlo, monospace", fontSize: 12, padding: 10, background: "#fff", borderRadius: 6, overflow: "auto", maxHeight: 140 }}>
          {error.name}: {error.message}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={this.resetError}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            try again
          </button>
          <button
            type="button"
            onClick={this.copyDiagnostics}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            copy diagnostics
          </button>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            reload page
          </button>
        </div>
      </div>
    );
  }
}
