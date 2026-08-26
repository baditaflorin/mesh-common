import type { ReactNode } from "react";

export type MeshAppBarState =
  "ready" | "joining" | "offline" | "error" | "idle";

export type MeshAppBarProps = {
  /** Human-facing product name. Stable IDs stay in configuration, not in UI. */
  title: ReactNode;
  /** A short contextual label, such as “shared room” or “live session”. */
  eyebrow?: ReactNode;
  /** Honest room state. It is deliberately small so it never becomes a blank screen. */
  state?: MeshAppBarState;
  /** Optional semantic location trail. It replaces the duplicate title text. */
  breadcrumbs?: ReactNode;
  /** Compact, keyboard-accessible actions such as Invite and Settings. */
  actions?: ReactNode;
  className?: string;
};

const stateCopy: Record<MeshAppBarState, string> = {
  ready: "Live",
  joining: "Connecting",
  offline: "Offline",
  error: "Needs attention",
  idle: "Preparing",
};

/**
 * Lightweight global chrome for product apps. It intentionally does not own a
 * landmark or page heading: existing apps keep their own feature `<main>` and
 * `<h1>` while receiving one polished, non-overlapping control surface.
 */
export function MeshAppBar({
  title,
  eyebrow = "Mesh",
  state,
  breadcrumbs,
  actions,
  className,
}: MeshAppBarProps) {
  return (
    <div className={`mesh-app-bar ${className ?? ""}`}>
      <div className="mesh-app-bar-brand">
        <span className="mesh-app-bar-eyebrow">{eyebrow}</span>
        {breadcrumbs ? (
          <div className="mesh-app-bar-breadcrumbs">{breadcrumbs}</div>
        ) : (
          <span className="mesh-app-bar-title">{title}</span>
        )}
        {state ? (
          <span
            className={`mesh-app-bar-state mesh-app-bar-state--${state}`}
            aria-label={`Session status: ${stateCopy[state]}`}
          >
            {stateCopy[state]}
          </span>
        ) : null}
      </div>
      {actions ? (
        <nav className="mesh-app-bar-actions" aria-label="App controls">
          {actions}
        </nav>
      ) : null}
    </div>
  );
}
