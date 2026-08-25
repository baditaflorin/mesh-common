import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type MeshLayoutElement = "div" | "main" | "section" | "footer" | "nav";

type BaseLayoutProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "style"
> & {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

export type MeshPageProps = BaseLayoutProps & {
  /** Semantic element; `main` is the default app-level landmark. */
  as?: "main" | "div" | "section";
  /** Keeps a readable line length without requiring app-specific CSS. */
  maxWidth?: number | string;
  /** Adds responsive inline breathing room, including iOS safe-area space. */
  padded?: boolean;
};

/**
 * Centers an app page and applies safe-area aware horizontal padding.
 * Pass `as="div"` for nested regions so an app still has only one `<main>`.
 */
export function MeshPage({
  as = "main",
  maxWidth = "72rem",
  padded = true,
  className,
  style,
  children,
  ...props
}: MeshPageProps) {
  const Element = as;
  return (
    <Element
      {...props}
      className={classes("mesh-page", className)}
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: cssLength(maxWidth),
        marginInline: "auto",
        ...(padded
          ? {
              paddingInline:
                "max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right))",
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </Element>
  );
}

export type MeshStackProps = BaseLayoutProps & {
  as?: MeshLayoutElement;
  gap?: number | string;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
};

/** A vertical layout primitive that replaces repeated `display:flex` columns. */
export function MeshStack({
  as = "div",
  gap = "1rem",
  align,
  justify,
  className,
  style,
  children,
  ...props
}: MeshStackProps) {
  const Element = as;
  return (
    <Element
      {...props}
      className={classes("mesh-stack", className)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: cssLength(gap),
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
    >
      {children}
    </Element>
  );
}

export type MeshClusterProps = BaseLayoutProps & {
  as?: MeshLayoutElement;
  gap?: number | string;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
};

/** A wrapping row for controls, tags, avatars, and compact action groups. */
export function MeshCluster({
  as = "div",
  gap = "0.75rem",
  align = "center",
  justify = "flex-start",
  className,
  style,
  children,
  ...props
}: MeshClusterProps) {
  const Element = as;
  return (
    <Element
      {...props}
      className={classes("mesh-cluster", className)}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: cssLength(gap),
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
    >
      {children}
    </Element>
  );
}

export type MeshGridProps = BaseLayoutProps & {
  as?: MeshLayoutElement;
  gap?: number | string;
  /** Minimum card width when `columns` is not set. */
  minItemWidth?: number | string;
  /** Explicit column count for a predictable compact grid. */
  columns?: number;
};

/** A responsive card grid with an auto-fit default for mobile screens. */
export function MeshGrid({
  as = "div",
  gap = "1rem",
  minItemWidth = "16rem",
  columns,
  className,
  style,
  children,
  ...props
}: MeshGridProps) {
  const Element = as;
  const gridTemplateColumns =
    columns && columns > 0
      ? `repeat(${Math.floor(columns)}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(min(${cssLength(minItemWidth)}, 100%), 1fr))`;
  return (
    <Element
      {...props}
      className={classes("mesh-grid", className)}
      style={{
        display: "grid",
        gridTemplateColumns,
        gap: cssLength(gap),
        ...style,
      }}
    >
      {children}
    </Element>
  );
}

export type MeshBottomBarProps = BaseLayoutProps & {
  as?: "footer" | "nav" | "div";
  /** Sticky retains the bar in document flow; fixed pins it above browser chrome. */
  position?: "fixed" | "sticky" | "static";
  /** Accessible label when using a navigation landmark. */
  ariaLabel?: string;
};

/**
 * Safe-area aware mobile action bar. It intentionally leaves colours and
 * borders to the app/theme stylesheet while guaranteeing its tap area clears
 * the iPhone home indicator.
 */
export function MeshBottomBar({
  as = "footer",
  position = "sticky",
  ariaLabel,
  className,
  style,
  children,
  ...props
}: MeshBottomBarProps) {
  const Element = as;
  return (
    <Element
      {...props}
      className={classes(
        "mesh-bottom-bar",
        `mesh-bottom-bar--${position}`,
        className,
      )}
      aria-label={as === "nav" ? (ariaLabel ?? "Actions") : props["aria-label"]}
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        position,
        zIndex: position === "static" ? undefined : 10,
        bottom: position === "static" ? undefined : 0,
        width: "100%",
        padding:
          "0.75rem max(1rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))",
        ...style,
      }}
    >
      {children}
    </Element>
  );
}
