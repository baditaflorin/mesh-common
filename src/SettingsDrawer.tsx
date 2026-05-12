import { useEffect, useState, type ReactNode } from "react";
import type { MeshConfig } from "./MeshConfig";
import {
  iceStorage,
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "./iceConfig";

type Props = {
  config: MeshConfig;
  open: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (next: string) => void;
  /** App-specific settings inserted between the room field and infra section. */
  children?: ReactNode;
};

export function SettingsDrawer({ config, open, onClose, roomId, onRoomChange, children }: Props) {
  const s = iceStorage(config.storagePrefix, {
    signalingUrl: config.signalingUrl,
    turnTokenUrl: config.turnTokenUrl,
  });
  const [signaling, setSignaling] = useState(() => loadSignalingUrl(s));
  const [tokenUrl, setTokenUrl] = useState(() => loadTurnTokenUrl(s));

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl(s));
      setTokenUrl(loadTurnTokenUrl(s));
    }
  }, [open, s]);

  if (!open) return null;

  return (
    <div className="mesh-settings-overlay" onClick={onClose}>
      <div className="mesh-settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => onRoomChange(e.target.value)} />
        </label>

        {children}

        <hr />

        <h3>Self-hosted infra (advanced)</h3>
        <p className="mesh-settings-help">
          Override the default signaling and TURN endpoints. Leave blank to use the built-in
          defaults (<code>{config.signalingUrl}</code> and <code>{config.turnTokenUrl}</code>).
        </p>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={config.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={config.turnTokenUrl}
          />
        </label>

        <div className="mesh-settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(s, signaling);
              saveTurnTokenUrl(s, tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(s, "");
              saveTurnTokenUrl(s, "");
              resetIceServers(s);
              onClose();
              location.reload();
            }}
          >
            Reset to defaults
          </button>
        </div>

        <hr />

        <footer className="mesh-settings-footer">
          <a href={config.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{config.version} · {config.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
