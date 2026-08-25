import type { HTMLAttributes, ReactNode } from "react";
import { meshClassNames, meshNonNegativeInteger } from "./presentationUtils";

export type MeshPresenceState = "connected" | "connecting" | "offline" | "idle";

export type MeshPresenceProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "role"
> & {
  /** Current number of devices or people represented by this presence signal. */
  count: number;
  /** Visible trailing text, such as "people here" or "devices synced". */
  label?: ReactNode;
  /** Connection context determines the indicator treatment in CSS. */
  state?: MeshPresenceState;
  size?: "sm" | "md";
  /** Announces changes without requiring apps to wire their own live region. */
  announce?: "polite" | "assertive" | false;
};

/**
 * Text-first room/device presence. Count and status stay legible without
 * avatars, icons, or a tooltip and can wrap safely in narrow layouts.
 */
export function MeshPresence({
  count,
  label,
  state = "connected",
  size = "sm",
  announce = false,
  className,
  "aria-label": ariaLabel,
  ...props
}: MeshPresenceProps) {
  const safeCount = meshNonNegativeInteger(count);
  const defaultLabel = safeCount === 1 ? "person here" : "people here";
  const visibleLabel = label ?? defaultLabel;
  const defaultAriaLabel =
    typeof label === "string"
      ? `${safeCount} ${label}`
      : `${safeCount} ${defaultLabel}`;
  const role =
    announce === "assertive" ? "alert" : announce ? "status" : "group";

  return (
    <div
      {...props}
      role={role}
      aria-live={announce || undefined}
      aria-atomic={announce ? true : undefined}
      aria-label={ariaLabel ?? defaultAriaLabel}
      className={meshClassNames(
        "mesh-presence",
        `mesh-presence-${state}`,
        `mesh-presence-${size}`,
        announce && "mesh-presence-announced",
        className,
      )}
      data-state={state}
      data-size={size}
    >
      <span className="mesh-presence-indicator" aria-hidden="true" />
      <span className="mesh-presence-count" aria-hidden="true">
        {safeCount}
      </span>
      <span className="mesh-presence-label" aria-hidden="true">
        {" "}
        {visibleLabel}
      </span>
    </div>
  );
}
