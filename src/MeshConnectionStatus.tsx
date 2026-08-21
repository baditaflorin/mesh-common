import { useNetworkOnline, type NetworkOnlineOptions, type NetworkOnlineState } from "./useNetworkOnline";
import { useNetworkQuality, type NetworkQualityOptions } from "./useNetworkQuality";
import type { YRoom } from "./useYRoom";

export type MeshConnectionStatusProps = {
  /** Room being joined. `null` means the room is still starting. Omit for a network-only badge. */
  room?: YRoom | null;
  /** Reuse an existing online probe result instead of rendering its result. */
  network?: NetworkOnlineState;
  /** Options for the built-in online probe when `network` is not supplied. */
  networkOptions?: NetworkOnlineOptions;
  /** Options for the optional peer latency measurement. */
  qualityOptions?: NetworkQualityOptions;
  /** Show peer count where a room is available. Default: true. */
  showPeers?: boolean;
  /** Show median peer latency when samples are available. Default: true. */
  showLatency?: boolean;
  /** Render just the current state label, without supporting detail. */
  compact?: boolean;
  /** Additional class for app-specific positioning or theming. */
  className?: string;
};

type ConnectionView = {
  state: "offline" | "connecting" | "online" | "ready" | "connected";
  label: string;
  detail: string;
};

function connectionView(
  online: boolean,
  room: YRoom | null | undefined,
  showPeers: boolean,
  showLatency: boolean,
  latency: number,
): ConnectionView {
  if (!online) {
    return { state: "offline", label: "Offline", detail: "Network unavailable" };
  }

  if (room === null) {
    return { state: "connecting", label: "Connecting", detail: "Joining room" };
  }

  if (!room) {
    return { state: "online", label: "Online", detail: "Network available" };
  }

  const peers = room.peerCount;
  const peerDetail = showPeers
    ? peers === 1
      ? "1 peer connected"
      : `${peers} peers connected`
    : "Room ready";
  const latencyDetail = showLatency && latency > 0 ? ` · ${Math.round(latency)} ms median` : "";

  if (peers > 0) {
    return { state: "connected", label: "Connected", detail: `${peerDetail}${latencyDetail}` };
  }
  return { state: "ready", label: "Ready", detail: `${peerDetail}${latencyDetail}` };
}

/**
 * Compact, screen-reader friendly network and room presence indicator.
 *
 * It combines the honest `useNetworkOnline` probe with `YRoom.peerCount` and
 * `useNetworkQuality` when a room is available. Pass a pre-existing `network`
 * value when an app already uses `useNetworkOnline` and wants one probe owner.
 *
 *   <MeshConnectionStatus room={room} />
 */
export function MeshConnectionStatus({
  room,
  network: suppliedNetwork,
  networkOptions,
  qualityOptions,
  showPeers = true,
  showLatency = true,
  compact = false,
  className,
}: MeshConnectionStatusProps) {
  // Hooks remain unconditional so a caller can add/remove a supplied state
  // without changing hook order. The supplied state remains authoritative.
  const detectedNetwork = useNetworkOnline(networkOptions);
  const network = suppliedNetwork ?? detectedNetwork;
  const quality = useNetworkQuality(room ?? null, qualityOptions);
  const view = connectionView(network.online, room, showPeers, showLatency, quality.median);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${view.label}. ${view.detail}`}
      data-state={view.state}
      className={`mesh-connection-status mesh-connection-status-${view.state} ${className ?? ""}`}
    >
      <span aria-hidden="true">●</span>{" "}
      <strong>{view.label}</strong>
      {!compact && <span>{`: ${view.detail}`}</span>}
    </div>
  );
}
