import { useId, type ReactNode } from "react";
import type { MeshConfig } from "./MeshConfig";
import { MeshConnectionStatus } from "./MeshConnectionStatus";
import { MeshShell } from "./MeshShell";
import { useOptionalMeshApp } from "./MeshAppProvider";
import type { YRoom } from "./useYRoom";

type ContractLifecycleState =
  "loading" | "joining" | "connected" | "offline" | "error";

function contractLifecycleState(
  app: ReturnType<typeof useOptionalMeshApp>,
): ContractLifecycleState | undefined {
  if (!app) return undefined;
  if (!app.network.online) return "offline";
  if (app.lifecycle.error) return "error";
  switch (app.lifecycle.status) {
    case "idle":
      return "loading";
    case "joining":
      return "joining";
    case "connected":
      return "connected";
    case "disconnected":
      // A provider status transition alone is not a fault. It may be a
      // normal reconnect, while `lifecycle.error` above remains the honest
      // signal for the contract's error state.
      return "joining";
  }
}

export type MeshAppFrameShellOptions = {
  roomId: string;
  onRoomChange: (next: string) => void;
  settingsExtras?: ReactNode;
  fleetIdentityServiceUrl?: string | null;
};

export type MeshAppFrameProps = {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Content shown before the standard title block, such as a compact score. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  navigation?: ReactNode;
  footer?: ReactNode;
  /** `undefined` uses the provider's compact connection status; `false` hides it. */
  connection?: ReactNode | false;
  /** Wrap the frame in the existing invite/settings/self-reference shell. */
  shell?: MeshAppFrameShellOptions;
  /** Needed only when using `shell` outside a MeshAppProvider. */
  config?: MeshConfig;
  /** Needed only when using `shell` outside a MeshAppProvider. */
  room?: YRoom | null;
  className?: string;
};

/**
 * A small, composable page frame for mesh apps.
 *
 * It leaves visual design to each app, while standardizing the semantic page
 * hierarchy, responsive-friendly header slots, optional connection status,
 * and (when requested) the existing invite/settings MeshShell.
 */
export function MeshAppFrame({
  children,
  title,
  description,
  eyebrow,
  actions,
  navigation,
  footer,
  connection,
  shell,
  config: suppliedConfig,
  room: suppliedRoom,
  className,
}: MeshAppFrameProps) {
  const app = useOptionalMeshApp();
  const titleId = useId();
  const lifecycleState = contractLifecycleState(app);
  const config = suppliedConfig ?? app?.config;
  const room = suppliedRoom ?? app?.room;
  const renderedConnection =
    connection === undefined && app ? (
      <MeshConnectionStatus room={app.room} network={app.network} compact />
    ) : (
      connection
    );
  const hasRenderedConnection =
    renderedConnection !== undefined &&
    renderedConnection !== null &&
    renderedConnection !== false;
  const hasHeading =
    title !== undefined ||
    description !== undefined ||
    eyebrow !== undefined ||
    actions !== undefined ||
    hasRenderedConnection;

  const frame = (
    <div className={`mesh-app-frame ${className ?? ""}`}>
      {hasHeading ? (
        <header className="mesh-app-frame-header">
          <div className="mesh-app-frame-heading">
            {eyebrow ? (
              <div className="mesh-app-frame-eyebrow">{eyebrow}</div>
            ) : null}
            {title ? <h1 id={titleId}>{title}</h1> : null}
            {description ? (
              <div className="mesh-app-frame-description">{description}</div>
            ) : null}
          </div>
          {hasRenderedConnection || actions ? (
            <div className="mesh-app-frame-actions">
              {renderedConnection}
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      {navigation ? (
        <nav
          className="mesh-app-frame-navigation"
          aria-label="Feature navigation"
        >
          {navigation}
        </nav>
      ) : null}
      <main
        className="mesh-app-frame-main"
        aria-labelledby={title ? titleId : undefined}
        data-mesh-app-shell=""
        data-mesh-room-state={lifecycleState}
      >
        {children}
      </main>
      {footer ? (
        <footer className="mesh-app-frame-footer">{footer}</footer>
      ) : null}
    </div>
  );

  if (!shell) return frame;
  if (!config) {
    throw new Error(
      "MeshAppFrame needs a MeshConfig when the shell option is enabled",
    );
  }
  return (
    <MeshShell
      config={config}
      roomId={shell.roomId}
      onRoomChange={shell.onRoomChange}
      room={room}
      settingsExtras={shell.settingsExtras}
      fleetIdentityServiceUrl={shell.fleetIdentityServiceUrl}
    >
      {frame}
    </MeshShell>
  );
}
