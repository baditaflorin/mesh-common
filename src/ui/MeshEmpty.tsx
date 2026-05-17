import type { ReactNode } from "react";

export type MeshEmptyProps = {
  /** Big symbol or emoji at the top (e.g. "🌱", "🗳", "📍"). */
  icon?: ReactNode;
  /** Headline message. */
  title: string;
  /** Optional sub-text. */
  message?: ReactNode;
  /** Optional CTA (button, link, etc.). */
  action?: ReactNode;
  /** Visual density. */
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Empty-state component for "no votes yet" / "no peers" / "no entries" etc.
 * Collapses the bespoke ad-hoc empty UIs every app rolls.
 *
 *   {votes.length === 0 ? (
 *     <MeshEmpty
 *       icon="🗳"
 *       title="no votes yet"
 *       message="cast the first vote to get things going"
 *     />
 *   ) : ( <VoteList .../> )}
 */
export function MeshEmpty({
  icon,
  title,
  message,
  action,
  size = "md",
  className,
}: MeshEmptyProps) {
  return (
    <div className={`mesh-empty mesh-empty-${size} ${className ?? ""}`} role="status">
      {icon && <div className="mesh-empty-icon">{icon}</div>}
      <p className="mesh-empty-title">{title}</p>
      {message && <p className="mesh-empty-message">{message}</p>}
      {action && <div className="mesh-empty-action">{action}</div>}
    </div>
  );
}
