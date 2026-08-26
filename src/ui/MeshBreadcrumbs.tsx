import type { MouseEventHandler, ReactNode } from "react";

export type MeshBreadcrumbItem = {
  /** A stable key is useful when a trail changes as a feature advances. */
  id?: string;
  /** Human-facing location label. The final item is announced as the page. */
  label: ReactNode;
  /** Uses a native link when supplied on a non-current item. */
  href?: string;
  /** Uses a real button for in-app state transitions. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

export type MeshBreadcrumbsProps = {
  /** Ordered from the broadest location to the current location. */
  items: readonly MeshBreadcrumbItem[];
  /** Use a specific landmark name when a page exposes more than one trail. */
  ariaLabel?: string;
  className?: string;
  /** Reduces rhythm for use inside compact app chrome. */
  compact?: boolean;
};

/**
 * A semantic, deliberately small location trail. It preserves every item in
 * a horizontally scrollable list instead of hiding navigable context on a
 * narrow screen. Apps can use links for URL navigation or buttons for local
 * feature-state transitions.
 */
export function MeshBreadcrumbs({
  items,
  ariaLabel = "Breadcrumb",
  className,
  compact = false,
}: MeshBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`mesh-breadcrumbs${compact ? " mesh-breadcrumbs--compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <ol className="mesh-breadcrumbs-list">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const key = item.id ?? index;
          return (
            <li className="mesh-breadcrumbs-item" key={key}>
              {index > 0 ? (
                <span aria-hidden="true" className="mesh-breadcrumbs-separator">
                  /
                </span>
              ) : null}
              {current ? (
                <span aria-current="page" className="mesh-breadcrumbs-current">
                  {item.label}
                </span>
              ) : item.onClick ? (
                <button
                  className="mesh-breadcrumbs-button"
                  disabled={item.disabled}
                  onClick={item.onClick}
                  type="button"
                >
                  {item.label}
                </button>
              ) : item.href ? (
                <a className="mesh-breadcrumbs-link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span className="mesh-breadcrumbs-current">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
