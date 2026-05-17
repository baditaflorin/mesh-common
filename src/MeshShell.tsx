import { useEffect, useState, type ReactNode } from "react";
import type { MeshConfig } from "./MeshConfig";
import type { YRoom } from "./useYRoom";
import { SelfRefBar } from "./SelfRefBar";
import { SettingsDrawer } from "./SettingsDrawer";
import { InviteShareButton } from "./InviteShareButton";
import { useInviteChain } from "./useInviteChain";

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
  children: ReactNode;
};

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
export function MeshShell({
  config,
  roomId,
  onRoomChange,
  room,
  settingsExtras,
  children,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chain = useInviteChain(room ?? null, config);

  useEffect(() => {
    document.documentElement.style.setProperty("--mesh-accent", config.accentHex);
  }, [config.accentHex]);

  return (
    <div className="mesh-app-root">
      {children}
      <InviteShareButton
        appName={config.appName}
        roomId={roomId}
        peerId={room?.peerId}
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
        {settingsExtras}
      </SettingsDrawer>
    </div>
  );
}
