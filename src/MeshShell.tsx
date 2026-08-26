import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  humanizeMeshAppName,
  meshAccentText,
  type MeshConfig,
} from "./MeshConfig";
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
import { MeshAppBar, type MeshAppBarState } from "./ui/MeshAppBar";
import { MeshBreadcrumbs } from "./ui/MeshBreadcrumbs";
import { getMeshVisualProfileTokens } from "./ui/MeshVisualProfile";
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
  // A config with no explicit visual profile is a pre-foundation app. Keep
  // its established palette until its own visual migration chooses a profile
  // and a shell layout; changing hundreds of applications by accident is not
  // a product redesign.
  if (!config.shellLayout) {
    return {
      canvas: "#0b0a06",
      surface: "#1b1810",
      surfaceRaised: "#242017",
      text: "#f6e9c0",
      textMuted: "#8a7a4a",
      accent: config.accentHex,
      accentText: meshAccentText(config.accentHex, "#0b0a06"),
    };
  }
  const profile = getMeshVisualProfileTokens(config.visualProfile ?? "utility");
  return {
    // Profiles deliberately supply full semantic foundations. The app accent
    // remains app-owned, so a product preserves its recognizable action color
    // while shedding the old universal brown/black demo skin.
    ...profile,
    accent: config.accentHex,
    accentText: meshAccentText(config.accentHex, profile.accentText),
    focusRing: config.accentHex,
  };
}

function displayNameFor(config: MeshConfig): string {
  return config.displayName?.trim() || humanizeMeshAppName(config.appName);
}

function appBarState(
  roomState: ShellRoomState | undefined,
): MeshAppBarState | undefined {
  switch (roomState) {
    case "connected":
      return "ready";
    case "loading":
      return "idle";
    case "joining":
      return "joining";
    case "offline":
      return "offline";
    case "error":
      return "error";
    default:
      return undefined;
  }
}

/**
 * Standard chrome for every mesh-* app:
 *   - a compact, human-named utility bar with invite + settings actions
 *   - invite modal with dynamic QR + share / copy-link (every app)
 *   - settings drawer with room, identity, connection, and About details
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
  const displayName = displayNameFor(config);
  const breadcrumbs = config.breadcrumbs;
  const visualProfile = config.visualProfile ?? "utility";
  const hasModernChrome = config.shellLayout !== undefined;
  const shellLayout = config.shellLayout ?? "legacy";
  const shellStyle = {
    "--mesh-accent": config.accentHex,
    "--mesh-accent-text": meshAccentText(config.accentHex),
  } as CSSProperties;
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
      data-mesh-visual-profile={visualProfile}
      data-mesh-shell-layout={shellLayout}
      data-mesh-app-id={config.appName}
      data-mesh-breadcrumbs={breadcrumbs ? "enabled" : undefined}
      style={shellStyle}
    >
      {hasModernChrome ? (
        <MeshAppBar
          title={displayName}
          state={appBarState(roomState)}
          breadcrumbs={
            breadcrumbs && breadcrumbs.items.length > 0 ? (
              <MeshBreadcrumbs
                ariaLabel={breadcrumbs.ariaLabel ?? `${displayName} location`}
                compact
                items={breadcrumbs.items}
              />
            ) : undefined
          }
          actions={
            <>
              <InviteShareButton
                appName={displayName}
                roomId={roomId}
                peerId={activeRoom?.peerId}
                label="Invite"
                ariaLabel={`Invite people to ${displayName}`}
                className="mesh-app-bar-action mesh-app-bar-invite"
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
                className="mesh-app-bar-action mesh-settings-fab"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
              >
                Settings
              </button>
            </>
          }
        />
      ) : null}
      <div className="mesh-app-content">{children}</div>
      {!hasModernChrome ? (
        <>
          <InviteShareButton
            appName={config.appName}
            roomId={roomId}
            peerId={activeRoom?.peerId}
            className="mesh-legacy-invite"
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
        </>
      ) : null}
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
