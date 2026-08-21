import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeshConfig } from "./MeshConfig";
import {
  iceStorage,
  isValidSignalingUrl,
  isValidTurnTokenUrl,
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "./iceConfig";
import { beaconOptedOut, setBeaconOptOut } from "./useMeshBeacon";
import { MeshSheet } from "./ui/MeshSheet";

function BeaconOptOutToggle() {
  const [out, setOut] = useState<boolean>(() => beaconOptedOut());
  return (
    <label className="mesh-settings-beacon">
      <input
        type="checkbox"
        checked={out}
        onChange={(e) => {
          const v = e.target.checked;
          setBeaconOptOut(v);
          setOut(v);
        }}
      />{" "}
      Opt out of anonymous pageview pings
      <p className="mesh-settings-help">
        Each app fires a 1×1 GIF beacon with room id + first 6 chars of your peer
        id when you join a room. IPs are truncated; Do-Not-Track is honoured.
        Toggle this to disable per-device.
      </p>
    </label>
  );
}

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
  const s = useMemo(
    () =>
      iceStorage(config.storagePrefix, {
        signalingUrl: config.signalingUrl,
        turnTokenUrl: config.turnTokenUrl,
      }),
    [config.storagePrefix, config.signalingUrl, config.turnTokenUrl],
  );
  const [signaling, setSignaling] = useState(() => loadSignalingUrl(s));
  const [tokenUrl, setTokenUrl] = useState(() => loadTurnTokenUrl(s));
  const signalingError = signaling.trim() && !isValidSignalingUrl(signaling)
    ? "Use a ws:// or wss:// URL."
    : "";
  const tokenUrlError = tokenUrl.trim() && !isValidTurnTokenUrl(tokenUrl)
    ? "Use an http:// or https:// URL."
    : "";
  const hasEndpointError = Boolean(signalingError || tokenUrlError);

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl(s));
      setTokenUrl(loadTurnTokenUrl(s));
    }
  }, [open, s]);

  return (
    <MeshSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Settings"
      description="Room, identity, and connection preferences for this device."
      variant="bottom"
      className="mesh-settings-sheet"
      footer={
        <footer className="mesh-settings-footer">
          <a href={config.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{config.version} · {config.commit}
          </span>
        </footer>
      }
    >
      <div className="mesh-settings-content">
        <label>
          <span>Room ID</span>
          <input
            value={roomId}
            onChange={(e) => onRoomChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
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
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            aria-invalid={Boolean(signalingError)}
            aria-describedby={signalingError ? "mesh-signaling-error" : undefined}
          />
          {signalingError && <span id="mesh-signaling-error" role="alert" className="mesh-settings-error">{signalingError}</span>}
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={config.turnTokenUrl}
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            aria-invalid={Boolean(tokenUrlError)}
            aria-describedby={tokenUrlError ? "mesh-turn-token-error" : undefined}
          />
          {tokenUrlError && <span id="mesh-turn-token-error" role="alert" className="mesh-settings-error">{tokenUrlError}</span>}
        </label>

        <div className="mesh-settings-actions">
          <button
            type="button"
            disabled={hasEndpointError}
            onClick={() => {
              saveSignalingUrl(s, signaling);
              saveTurnTokenUrl(s, tokenUrl);
              // TURN credentials are short-lived and tied to this endpoint.
              // Do not carry a cached credential set across an endpoint change.
              resetIceServers(s);
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

        <BeaconOptOutToggle />

        <hr />

      </div>
    </MeshSheet>
  );
}
