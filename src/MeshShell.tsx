import { useEffect, useState, type ReactNode } from "react";
import type { MeshConfig } from "./MeshConfig";
import { SelfRefBar } from "./SelfRefBar";
import { SettingsDrawer } from "./SettingsDrawer";

type Props = {
  config: MeshConfig;
  roomId: string;
  onRoomChange: (next: string) => void;
  /** App-specific settings UI injected into the drawer. */
  settingsExtras?: ReactNode;
  children: ReactNode;
};

/**
 * Standard chrome for every mesh-* app:
 *   - ⚙ FAB to open the settings drawer
 *   - Settings drawer with Room ID + signaling/TURN overrides
 *   - Bottom-right self-ref bar with source / tip / version
 *
 * Apps render their own UI as children and pass app-specific settings via
 * `settingsExtras`.
 */
export function MeshShell({ config, roomId, onRoomChange, settingsExtras, children }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--mesh-accent", config.accentHex);
  }, [config.accentHex]);

  return (
    <div className="mesh-app-root">
      {children}
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
