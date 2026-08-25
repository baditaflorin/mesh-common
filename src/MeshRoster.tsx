import { useId, type ReactNode } from "react";
import { PeerAvatar } from "./PeerAvatar";
import {
  usePeerCapabilities,
  type PeerCapabilities,
} from "./usePeerCapabilities";
import { useRoster } from "./useRoster";
import type { YRoom } from "./useYRoom";

export type MeshRosterPeerState = "local" | "present" | "stale";

export type MeshRosterPeer = {
  /** Ephemeral mesh session id, not a physical-device identifier. */
  sessionId: string;
  /** A caller-supplied display name, if one is known for this session. */
  name?: string;
  state: MeshRosterPeerState;
  lastSeenAt?: number;
  capabilities: PeerCapabilities;
  isSelf: boolean;
};

export type MeshRosterState = {
  peers: MeshRosterPeer[];
  /** Live browser sessions (not a count of people or phones). */
  liveSessionCount: number;
  staleSessionCount: number;
};

export type MeshRosterOptions = {
  names?: Record<string, string | undefined>;
  selfName?: string;
  heartbeatMs?: number;
  freshnessMs?: number;
};

export type MeshRosterProps = MeshRosterOptions & {
  room: YRoom | null;
  title?: string;
  emptyMessage?: ReactNode;
  /** Exclude stale sessions from the visible list. Defaults to false. */
  hideStale?: boolean;
  className?: string;
  renderPeer?: (peer: MeshRosterPeer) => ReactNode;
};

/** A short, explicitly session-scoped label suitable for debugging UI. */
export function meshSessionLabel(sessionId: string): string {
  return `session ${sessionId.slice(0, 8) || "unknown"}`;
}

/**
 * Compose heartbeat roster data and ephemeral capability awareness into an
 * honest UI model. It intentionally reports *sessions*: browsers/tabs may be
 * separate sessions even on one physical device, and no physical-device count
 * can be inferred from WebRTC awareness.
 */
export function useMeshRoster(
  room: YRoom | null,
  options: MeshRosterOptions = {},
): MeshRosterState {
  const roster = useRoster(room, {
    heartbeatMs: options.heartbeatMs,
    freshnessMs: options.freshnessMs,
    // This UI explicitly reports browser sessions. Reusing the person-facing
    // default would collapse Safari/Chrome/tabs that intentionally connect as
    // separate mesh sessions.
    dedupeByDevice: false,
  });
  const capabilityState = usePeerCapabilities(room);
  const ownId = room?.peerId;
  const ids = new Set<string>();
  if (ownId) ids.add(ownId);
  roster.present.forEach((id) => ids.add(id));
  roster.absent.forEach((id) => ids.add(id));

  const peers = [...ids]
    .map<MeshRosterPeer>((sessionId) => {
      const isSelf = sessionId === ownId;
      const present = roster.isPresent(sessionId);
      const state: MeshRosterPeerState = isSelf
        ? "local"
        : present
          ? "present"
          : "stale";
      return {
        sessionId,
        name: isSelf
          ? (options.selfName ?? options.names?.[sessionId])
          : options.names?.[sessionId],
        state,
        lastSeenAt: roster.lastSeenOf(sessionId),
        capabilities: isSelf
          ? capabilityState.mine
          : (capabilityState.peers.get(sessionId) ?? {}),
        isSelf,
      };
    })
    .sort((first, second) => {
      if (first.isSelf !== second.isSelf) return first.isSelf ? -1 : 1;
      if (first.state !== second.state) return first.state === "stale" ? 1 : -1;
      return first.sessionId.localeCompare(second.sessionId);
    });

  return {
    peers,
    liveSessionCount: peers.filter((peer) => peer.state !== "stale").length,
    staleSessionCount: peers.filter((peer) => peer.state === "stale").length,
  };
}

function defaultPeer(peer: MeshRosterPeer): ReactNode {
  const capabilityNames = Object.entries(peer.capabilities)
    .filter(([, supported]) => supported)
    .map(([capability]) => capability);
  const label = peer.name?.trim() || meshSessionLabel(peer.sessionId);
  const stateLabel =
    peer.state === "local"
      ? "this session"
      : peer.state === "present"
        ? "live"
        : "stale";
  return (
    <>
      <PeerAvatar seed={peer.sessionId} size={32} label={`${label} avatar`} />
      <span className="mesh-roster-peer-copy">
        <strong>{label}</strong>
        <span>{meshSessionLabel(peer.sessionId)}</span>
      </span>
      <span className="mesh-roster-peer-state">{stateLabel}</span>
      {capabilityNames.length > 0 && (
        <span
          className="mesh-roster-peer-capabilities"
          aria-label={`Capabilities: ${capabilityNames.join(", ")}`}
        >
          {capabilityNames.join(", ")}
        </span>
      )}
    </>
  );
}

/**
 * Accessible session roster for shared apps. Pair it with `useNamedPeer` by
 * passing `names`; it deliberately labels counts as sessions rather than
 * people, phones, or hardware devices.
 */
export function MeshRoster({
  room,
  title = "Live sessions",
  emptyMessage = "No live sessions yet.",
  hideStale = false,
  className,
  renderPeer,
  names,
  selfName,
  heartbeatMs,
  freshnessMs,
}: MeshRosterProps) {
  const headingId = useId();
  const roster = useMeshRoster(room, {
    names,
    selfName,
    heartbeatMs,
    freshnessMs,
  });
  const peers = hideStale
    ? roster.peers.filter((peer) => peer.state !== "stale")
    : roster.peers;

  return (
    <section
      className={`mesh-roster ${className ?? ""}`.trim()}
      aria-labelledby={headingId}
    >
      <header className="mesh-roster-header">
        <h2 id={headingId}>{title}</h2>
        <p role="status" aria-live="polite">
          {roster.liveSessionCount} live{" "}
          {roster.liveSessionCount === 1 ? "session" : "sessions"}
          {roster.staleSessionCount > 0
            ? ` · ${roster.staleSessionCount} stale`
            : ""}
        </p>
      </header>
      <p className="mesh-roster-disclaimer">
        Counts browser sessions, not physical phones or people.
      </p>
      {peers.length === 0 ? (
        <p role="status">{emptyMessage}</p>
      ) : (
        <ul className="mesh-roster-list">
          {peers.map((peer) => (
            <li
              key={peer.sessionId}
              className={`mesh-roster-peer mesh-roster-peer-${peer.state}`}
            >
              {renderPeer ? renderPeer(peer) : defaultPeer(peer)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
