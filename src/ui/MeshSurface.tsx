import type { HTMLAttributes, ReactNode } from "react";
import { meshClassNames } from "./presentationUtils";

export type MeshSurfaceElement = "div" | "section" | "article" | "aside";
export type MeshSurfaceTone = "base" | "raised" | "quiet" | "accent";
export type MeshSurfacePadding = "none" | "sm" | "md" | "lg";

export type MeshSurfaceProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  /** Choose a meaningful landmark only when this surface represents one. */
  as?: MeshSurfaceElement;
  children: ReactNode;
  /** Visual elevation hook for the shared stylesheet. */
  tone?: MeshSurfaceTone;
  /** Responsive spacing hook; concrete spacing remains stylesheet-owned. */
  padding?: MeshSurfacePadding;
  /** Lets an app intentionally reach the viewport edge on narrow screens. */
  bleedOnMobile?: boolean;
};

/**
 * Semantic container with stable visual hooks for cards, panels, and stages.
 * It deliberately owns no colors or measurements, so each app can keep its
 * visual profile while the fleet shares a reliable surface vocabulary.
 */
export function MeshSurface({
  as: Element = "div",
  children,
  tone = "base",
  padding = "md",
  bleedOnMobile = false,
  className,
  ...props
}: MeshSurfaceProps) {
  return (
    <Element
      {...props}
      className={meshClassNames(
        "mesh-surface",
        `mesh-surface-${tone}`,
        `mesh-surface-padding-${padding}`,
        bleedOnMobile && "mesh-surface-bleed-mobile",
        className,
      )}
      data-tone={tone}
      data-padding={padding}
    >
      {children}
    </Element>
  );
}
