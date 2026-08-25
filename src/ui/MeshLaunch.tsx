import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  useId,
} from "react";

type MeshLaunchActionBase = {
  /** Accessible visible label for the action. */
  label: ReactNode;
  /** Adds an app-specific visual hook without replacing the base class. */
  className?: string;
};

export type MeshLaunchButtonAction = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
> &
  MeshLaunchActionBase & {
    href?: never;
  };

export type MeshLaunchLinkAction = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "className" | "href"
> &
  MeshLaunchActionBase & {
    href: string;
  };

/** A native button or link used by a MeshLaunch action. */
export type MeshLaunchAction = MeshLaunchButtonAction | MeshLaunchLinkAction;

export type MeshLaunchProps = {
  /** Small contextual label above the heading, such as a room type. */
  eyebrow?: ReactNode;
  /** The launch screen's primary, semantic heading. */
  heading: ReactNode;
  /** Lets a nested entry surface use a lower-level semantic heading. */
  headingLevel?: 1 | 2 | 3;
  /** A concise explanation of the shared experience about to begin. */
  promise: ReactNode;
  /** Live or static social context, such as who is already in the room. */
  presence?: ReactNode;
  /** The required next step for starting or joining the experience. */
  primaryAction: MeshLaunchAction;
  /** A less prominent alternative, such as viewing an explanation first. */
  secondaryAction?: MeshLaunchAction;
  /** Optional app-owned visual or interactive preview content. */
  preview?: ReactNode;
  /** Keeps an honest connection state visible without replacing the entry. */
  loading?: boolean;
  /** Specific connection information shown during or after loading. */
  connectionHint?: ReactNode;
  /** Fallback shown when loading has started but no connection hint exists. */
  loadingHint?: ReactNode;
  /** Additional class for app-specific layout and theming. */
  className?: string;
};

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

function hasContent(value: ReactNode | undefined): value is ReactNode {
  return value !== undefined && value !== null && value !== false;
}

function MeshLaunchActionControl({
  action,
  variant,
}: {
  action: MeshLaunchAction;
  variant: "primary" | "secondary";
}) {
  const actionClassName = classes(
    "mesh-launch-action",
    `mesh-launch-action-${variant}`,
    action.className,
  );

  if (action.href !== undefined) {
    const { label, className: _className, href, ...linkProps } = action;
    return (
      <a {...linkProps} href={href} className={actionClassName}>
        {label}
      </a>
    );
  }

  const { label, className: _className, type, ...buttonProps } = action;
  return (
    <button
      {...buttonProps}
      type={type ?? "button"}
      className={actionClassName}
    >
      {label}
    </button>
  );
}

function LaunchHeading({
  id,
  level,
  children,
}: {
  id: string;
  level: NonNullable<MeshLaunchProps["headingLevel"]>;
  children: ReactNode;
}) {
  if (level === 2) return <h2 id={id}>{children}</h2>;
  if (level === 3) return <h3 id={id}>{children}</h3>;
  return <h1 id={id}>{children}</h1>;
}

/**
 * A complete, app-owned visual entry point for a shared room experience.
 *
 * It deliberately provides structure and accessibility only. Applications
 * own visual treatment through the emitted class names and may keep their
 * unique preview content in the optional preview slot.
 */
export function MeshLaunch({
  eyebrow,
  heading,
  headingLevel = 1,
  promise,
  presence,
  primaryAction,
  secondaryAction,
  preview,
  loading = false,
  connectionHint,
  loadingHint = "Preparing your shared space…",
  className,
}: MeshLaunchProps) {
  const headingId = useId();
  const promiseId = useId();
  const showPresence = hasContent(presence);
  const showPreview = hasContent(preview);
  const showConnection = loading || hasContent(connectionHint);
  const statusMessage = hasContent(connectionHint)
    ? connectionHint
    : loading
      ? loadingHint
      : null;

  return (
    <section
      className={classes(
        "mesh-launch",
        loading && "mesh-launch-loading",
        className,
      )}
      aria-labelledby={headingId}
      aria-describedby={promiseId}
      aria-busy={loading || undefined}
    >
      <div className="mesh-launch-content">
        <header className="mesh-launch-header">
          {hasContent(eyebrow) && (
            <p className="mesh-launch-eyebrow">{eyebrow}</p>
          )}
          <LaunchHeading id={headingId} level={headingLevel}>
            {heading}
          </LaunchHeading>
          <p id={promiseId} className="mesh-launch-promise">
            {promise}
          </p>
        </header>

        {showPresence && (
          <div
            className="mesh-launch-presence"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {presence}
          </div>
        )}

        {showPreview && <div className="mesh-launch-preview">{preview}</div>}

        <div
          className="mesh-launch-actions"
          role="group"
          aria-label="Launch actions"
        >
          <MeshLaunchActionControl action={primaryAction} variant="primary" />
          {secondaryAction && (
            <MeshLaunchActionControl
              action={secondaryAction}
              variant="secondary"
            />
          )}
        </div>

        {showConnection && (
          <p
            className={classes(
              "mesh-launch-connection",
              loading && "mesh-launch-connection-loading",
            )}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {loading && (
              <span
                className="mesh-launch-connection-indicator"
                aria-hidden="true"
              />
            )}
            <span className="mesh-launch-connection-message">
              {statusMessage}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
