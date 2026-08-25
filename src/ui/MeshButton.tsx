import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { meshClassNames } from "./presentationUtils";

export type MeshButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type MeshButtonSize = "sm" | "md" | "lg";

export type MeshButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: ReactNode;
  /** Semantic intent exposed as a stylesheet hook. */
  variant?: MeshButtonVariant;
  /** Size hook; CSS owns exact touch-target dimensions. */
  size?: MeshButtonSize;
  /** Makes a primary action naturally fill an available narrow layout. */
  fullWidth?: boolean;
  /** Blocks repeated actions while retaining the action's visible label. */
  loading?: boolean;
};

/**
 * Native button with a fleet-wide state vocabulary. It intentionally renders
 * no icon or spinner: apps may add their own content while screen readers get
 * the native disabled and aria-busy signals.
 */
export const MeshButton = forwardRef<HTMLButtonElement, MeshButtonProps>(
  function MeshButton(
    {
      children,
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      disabled = false,
      type = "button",
      className,
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={meshClassNames(
          "mesh-button",
          `mesh-button-${variant}`,
          `mesh-button-${size}`,
          fullWidth && "mesh-button-full-width",
          loading && "is-loading",
          className,
        )}
        data-variant={variant}
        data-size={size}
        data-layout={fullWidth ? "full-width" : "inline"}
        data-loading={loading ? "true" : "false"}
      >
        {children}
      </button>
    );
  },
);
