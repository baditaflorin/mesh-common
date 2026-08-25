import type { HTMLAttributes, ReactNode } from "react";
import { meshClassNames } from "./presentationUtils";

export type MeshStatusTone =
  "neutral" | "info" | "success" | "warning" | "danger" | "live";

export type MeshStatusPillProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children" | "role"
> & {
  children: ReactNode;
  tone?: MeshStatusTone;
  size?: "sm" | "md";
  /** Decorative state indicator; it is hidden from assistive technology. */
  dot?: boolean;
  /** Promotes an updating status to a live region when the caller needs it. */
  announce?: "polite" | "assertive" | false;
};

/**
 * Compact, text-first state marker. The visual dot is deliberately a plain
 * element rather than an emoji or icon so applications can theme it reliably.
 */
export function MeshStatusPill({
  children,
  tone = "neutral",
  size = "sm",
  dot = false,
  announce = false,
  className,
  ...props
}: MeshStatusPillProps) {
  const role =
    announce === "assertive" ? "alert" : announce ? "status" : undefined;

  return (
    <span
      {...props}
      role={role}
      aria-live={announce || undefined}
      aria-atomic={announce ? true : undefined}
      className={meshClassNames(
        "mesh-status-pill",
        `mesh-status-pill-${tone}`,
        `mesh-status-pill-${size}`,
        dot && "mesh-status-pill-with-dot",
        className,
      )}
      data-tone={tone}
      data-size={size}
    >
      {dot ? (
        <span className="mesh-status-pill-dot" aria-hidden="true" />
      ) : null}
      <span className="mesh-status-pill-label">{children}</span>
    </span>
  );
}
