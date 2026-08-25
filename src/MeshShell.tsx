import { useEffect, useState, type ReactNode } from "react";
import type { MeshConfig } from "./MeshConfig";
import {
  MeshShellConnectionBridgeProvider,
  useOptionalMeshShellConnectionBridge,
} from "./MeshShellConnectionBridge";
import type { YRoom } from "./useYRoom";
import { MeshAppProvider, useOptionalMeshApp } from "./MeshAppProvider";
import { MeshConnectionPanel } from "./MeshConnectionPanel";
import { MeshSessionProvider } from "./meshSession";
import { SelfRefBar } from "./SelfRefBar";
import { SettingsDrawer } from "./SettingsDrawer";
import { InviteShareButton } from "./InviteShareButton";
import { useInviteChain } from "./useInviteChain";
import { useMeshBeacon } from "./useMeshBeacon";
import { useNetworkOnline, type NetworkOnlineState } from "./useNetworkOnline";
import { useRoomLifecycle, type RoomLifecycle } from "./useRoomLifecycle";
import {
  MeshThemeProvider,
  useOptionalMeshTheme,
  type MeshThemeTokens,
} from "./ui/MeshThemeProvider";
import { FleetIdentityPanel } from "./FleetIdentityPanel";

type Props = {
  config: MeshConfig;
  roomId: string;
  onRoomChange: (next: string) => void;
  /**
   * Optional Yjs room. When provided, the invite QR encodes the local peer id
   * (`p=...`) so receivers can record a chain edge, and `useInviteChain`
   * observes the shared `__mesh_invites` graph.
   */
  room?: YRoom | null;
  /** App-specific settings UI injected into the drawer. */
  settingsExtras?: ReactNode;
  /**
   * Cross-origin persona sync service URL. Defaults to the fleet's canonical
   * `https://fleet-persona.0exec.com`. Pass `null` to hide the fleet-identity
   * panel entirely (e.g. for kiosks or apps that own their own identity flow).
   */
  fleetIdentityServiceUrl?: string | null;
  children: ReactNode;
};

type ShellRoomState = "loading" | "joining" | "connected" | "offline" | "error";

function shellRoomState(
  lifecycle: RoomLifecycle | undefined,
  network: NetworkOnlineState | undefined,
): ShellRoomState | undefined {
  if (!lifecycle || !network) return undefined;
  if (!network.online) return "offline";
  if (lifecycle.error) return "error";
  switch (lifecycle.status) {
    case "connected":
      return "connected";
    case "idle":
      return "loading";
    case "joining":
    case "disconnected":
      return "joining";
  }
}

function legacyShellTokens(config: MeshConfig): Partial<MeshThemeTokens> {
  return {
    canvas: "#0b0a06",
    surface: "#1b1810",
    surfaceRaised: "#242017",
    text: "#f6e9c0",
    textMuted: "#8a7a4a",
    accent: config.accentHex,
    accentText: "#0b0a06",
  };
}

/**
 * Standard chrome for every mesh-* app:
 *   - 📡 FAB → modal with dynamic invite QR + share / copy-link (every app)
 *   - ⚙ FAB → settings drawer (room id, signaling, TURN)
 *   - Bottom-right self-ref bar with source / tip / version
 *   - Shared invite-chain tracker (`__mesh_invites` Y.Array) when `room` is provided
 *
 * Apps render their own UI as children and pass app-specific settings via
 * `settingsExtras`.
 */
function MeshShellContent({
  config,
  roomId,
  onRoomChange,
  room,
  settingsExtras,
  fleetIdentityServiceUrl,
  children,
}: Props) {
  const app = useOptionalMeshApp();
  const bridge = useOptionalMeshShellConnectionBridge();
  const reported = bridge?.connection;
  const activeRoom = room ?? reported?.room ?? app?.room ?? null;
  const lifecycle = reported?.lifecycle ?? app?.lifecycle;
  const network = reported?.network ?? app?.network;
  // An explicit `room` prop is the canonical shell-owned path. A feature that
  // owns its connection starts reporting only after it has created a real
  // room through MeshShellConnectionBridge; before that we show no invented
  // lifecycle or diagnostics.
  const hasRoomOwner = room !== undefined || Boolean(reported);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chain = useInviteChain(activeRoom, config);
  useMeshBeacon({
    app: config.appName,
    room: roomId,
    peer: activeRoom?.peerId,
    v: config.commit,
    event: "pv",
  });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--mesh-accent",
      config.accentHex,
    );
  }, [config.accentHex]);

  const roomState = shellRoomState(lifecycle, network);

  return (
    <div
      className="mesh-app-root"
      data-mesh-app-shell=""
      data-mesh-room-state={hasRoomOwner ? roomState : undefined}
    >
      {children}
      <InviteShareButton
        appName={config.appName}
        roomId={roomId}
        peerId={activeRoom?.peerId}
        extras={
          chain.edges.length > 0 ? (
            <div className="mesh-invite-chain">
              <span>
                your invites: <strong>{chain.myDirectInvites}</strong>
              </span>
              <span>
                downstream: <strong>{chain.mySubtree.length}</strong>
              </span>
              {chain.myDepth > 0 && (
                <span>
                  your depth: <strong>{chain.myDepth}</strong>
                </span>
              )}
            </div>
          ) : null
        }
      />
      <button
        type="button"
        className="mesh-settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>
      <SelfRefBar config={config} />
      <SettingsDrawer
        config={config}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={onRoomChange}
      >
        {hasRoomOwner ? (
          <MeshConnectionPanel
            room={activeRoom}
            lifecycle={lifecycle}
            network={network}
            showRoomId
          />
        ) : null}
        {settingsExtras}
        {fleetIdentityServiceUrl !== null ? (
          <FleetIdentityPanel
            appName={config.storagePrefix}
            serviceUrl={fleetIdentityServiceUrl}
          />
        ) : null}
      </SettingsDrawer>
    </div>
  );
}

/**
 * Bridges the legacy shell to the modern UX foundations without changing an
 * app's feature tree. The network signal deliberately skips the external
 * reachability probe: every legacy app gets honest online/offline context,
 * while only feature code that opts in performs an explicit probe.
 */
function MeshShellFoundation({
  config,
  room,
  children,
}: Pick<Props, "config" | "room" | "children">) {
  return (
    <MeshShellConnectionBridgeProvider>
      <MeshShellFoundationContext config={config} room={room}>
        {children}
      </MeshShellFoundationContext>
    </MeshShellConnectionBridgeProvider>
  );
}

/** Keeps the bridge provider above the dynamic context consumers. */
function MeshShellFoundationContext({
  config,
  room: suppliedRoom,
  children,
}: Pick<Props, "config" | "room" | "children">) {
  const bridge = useOptionalMeshShellConnectionBridge();
  const reported = bridge?.connection;
  const activeRoom =
    suppliedRoom !== undefined ? suppliedRoom : (reported?.room ?? null);
  // Hooks remain unconditional so a feature can report/clear its connection
  // after a gesture without changing hook order.
  const derivedLifecycle = useRoomLifecycle(activeRoom);
  const passiveNetwork = useNetworkOnline({ probeUrl: false });
  const lifecycle = reported?.lifecycle ?? derivedLifecycle;
  const network = reported?.network ?? passiveNetwork;

  return (
    <MeshThemeProvider
      className="mesh-shell-theme"
      defaultMode="dark"
      tokens={legacyShellTokens(config)}
    >
      <MeshAppProvider
        config={config}
        room={activeRoom}
        lifecycle={lifecycle}
        network={network}
      >
        <MeshSessionProvider room={activeRoom}>{children}</MeshSessionProvider>
      </MeshAppProvider>
    </MeshThemeProvider>
  );
}

/**
 * Standard chrome for every mesh-* app.
 *
 * Existing apps get semantic theme tokens, shared app/lifecycle context,
 * session context, an accessible shell marker, and progressive connection
 * diagnostics automatically. Apps already using the new provider/theme stack
 * keep their existing owners; the shell only contributes session context.
 */
export function MeshShell(props: Props) {
  const app = useOptionalMeshApp();
  const theme = useOptionalMeshTheme();
  const room = props.room ?? app?.room ?? null;
  const content = <MeshShellContent {...props} />;

  if (!app) {
    return (
      <MeshShellFoundation config={props.config} room={props.room}>
        {content}
      </MeshShellFoundation>
    );
  }

  const withSession = (
    <MeshShellConnectionBridgeProvider>
      <MeshSessionProvider room={room}>{content}</MeshSessionProvider>
    </MeshShellConnectionBridgeProvider>
  );
  if (theme) return withSession;
  return (
    <MeshThemeProvider
      className="mesh-shell-theme"
      defaultMode="dark"
      tokens={legacyShellTokens(props.config)}
    >
      {withSession}
    </MeshThemeProvider>
  );
}
