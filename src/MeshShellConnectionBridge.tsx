import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NetworkOnlineState } from "./useNetworkOnline";
import type { RoomLifecycle } from "./useRoomLifecycle";
import type { YRoom } from "./useYRoom";

/**
 * Connection data reported by a feature which owns its own room lifecycle.
 *
 * The bridge deliberately accepts only an already-created room. It never
 * creates, connects, retries, or requests a browser permission on behalf of
 * the feature. Passing `null` clears the report, which makes it suitable for
 * gesture-gated room creation and teardown.
 */
export type MeshShellConnection = {
  room: YRoom;
  /** Optional feature-owned lifecycle; the shell may otherwise derive one. */
  lifecycle?: RoomLifecycle;
  /** Optional feature-owned network state; the shell may otherwise reuse its own. */
  network?: NetworkOnlineState;
};

export type MeshShellConnectionBridgeValue = {
  /** The latest live connection report, or `null` when no feature owns one. */
  connection: MeshShellConnection | null;
  /** Imperatively publish a connection from a feature event or effect. */
  report: (connection: MeshShellConnection) => void;
  /** Clear the connection previously published through `report`. */
  clear: () => void;
};

export type MeshShellConnectionBridgeProviderProps = {
  children: ReactNode;
};

type Owner = symbol;

type InternalBridgeValue = MeshShellConnectionBridgeValue & {
  reportFrom: (owner: Owner, connection: MeshShellConnection) => void;
  clearFrom: (owner: Owner) => void;
};

type StoredConnection = {
  owner: Owner;
  connection: MeshShellConnection;
};

const MeshShellConnectionBridgeContext =
  createContext<InternalBridgeValue | null>(null);

function sameConnection(
  first: MeshShellConnection,
  second: MeshShellConnection,
): boolean {
  const firstLifecycle = first.lifecycle;
  const secondLifecycle = second.lifecycle;
  const firstNetwork = first.network;
  const secondNetwork = second.network;
  return (
    first.room.doc === second.room.doc &&
    first.room.provider === second.room.provider &&
    first.room.peerId === second.room.peerId &&
    first.room.deviceId === second.room.deviceId &&
    first.room.peerCount === second.room.peerCount &&
    first.room.roomId === second.room.roomId &&
    firstLifecycle?.status === secondLifecycle?.status &&
    firstLifecycle?.joinedAt === secondLifecycle?.joinedAt &&
    firstLifecycle?.error === secondLifecycle?.error &&
    firstNetwork?.online === secondNetwork?.online &&
    firstNetwork?.lastChange === secondNetwork?.lastChange &&
    firstNetwork?.why === secondNetwork?.why
  );
}

/**
 * Stores one feature-owned connection for a surrounding `MeshShell`.
 *
 * `MeshShell` mounts this provider once around its feature tree. A feature
 * then renders `MeshShellConnectionBridge` after its own user gesture has
 * created a Yjs room. The provider uses ownership tokens so an old feature
 * instance cannot clear a newer report during React teardown.
 */
export function MeshShellConnectionBridgeProvider({
  children,
}: MeshShellConnectionBridgeProviderProps) {
  const [stored, setStored] = useState<StoredConnection | null>(null);
  const manualOwner = useRef<Owner | null>(null);
  if (!manualOwner.current) manualOwner.current = Symbol("mesh-shell-manual");

  const reportFrom = useCallback((owner: Owner, next: MeshShellConnection) => {
    setStored((current) =>
      current?.owner === owner && sameConnection(current.connection, next)
        ? current
        : { owner, connection: next },
    );
  }, []);
  const clearFrom = useCallback((owner: Owner) => {
    setStored((current) => (current?.owner === owner ? null : current));
  }, []);
  const report = useCallback(
    (connection: MeshShellConnection) => {
      reportFrom(manualOwner.current!, connection);
    },
    [reportFrom],
  );
  const clear = useCallback(() => {
    clearFrom(manualOwner.current!);
  }, [clearFrom]);

  const value = useMemo<InternalBridgeValue>(
    () => ({
      connection: stored?.connection ?? null,
      report,
      clear,
      reportFrom,
      clearFrom,
    }),
    [clear, clearFrom, report, reportFrom, stored],
  );

  return (
    <MeshShellConnectionBridgeContext.Provider value={value}>
      {children}
    </MeshShellConnectionBridgeContext.Provider>
  );
}

/** Returns the nearest shell bridge, or `null` outside a MeshShell. */
export function useOptionalMeshShellConnectionBridge(): MeshShellConnectionBridgeValue | null {
  return useContext(MeshShellConnectionBridgeContext);
}

/** Returns the nearest shell bridge and fails clearly when MeshShell is absent. */
export function useMeshShellConnectionBridge(): MeshShellConnectionBridgeValue {
  const bridge = useOptionalMeshShellConnectionBridge();
  if (!bridge) {
    throw new Error(
      "useMeshShellConnectionBridge must be used inside MeshShellConnectionBridgeProvider",
    );
  }
  return bridge;
}

export type MeshShellConnectionBridgeProps = {
  /** A feature's real Yjs room. `null` or `undefined` clears its report. */
  room: YRoom | null | undefined;
  /** Optional feature-owned lifecycle state. */
  lifecycle?: RoomLifecycle;
  /** Optional feature-owned network state. */
  network?: NetworkOnlineState;
};

/**
 * Declaratively reports a feature-owned connection to the nearest shell.
 *
 * It renders nothing and has no connection, retry, or permission side
 * effects. Mount it only after a feature's explicit user gesture creates its
 * room; pass `room={null}` after disarming to remove stale diagnostics.
 * Outside a provider it is intentionally a no-op, which makes staged shell
 * upgrades safe for independently deployed applications.
 */
export function MeshShellConnectionBridge({
  room,
  lifecycle,
  network,
}: MeshShellConnectionBridgeProps) {
  const bridge = useContext(MeshShellConnectionBridgeContext);
  const owner = useRef<Owner | null>(null);
  if (!owner.current) owner.current = Symbol("mesh-shell-connection");

  const reportFrom = bridge?.reportFrom;
  const clearFrom = bridge?.clearFrom;
  const roomDoc = room?.doc;
  const roomProvider = room?.provider;
  const roomPeerId = room?.peerId;
  const roomDeviceId = room?.deviceId;
  const roomPeerCount = room?.peerCount;
  const roomId = room?.roomId;
  const lifecycleStatus = lifecycle?.status;
  const lifecycleJoinedAt = lifecycle?.joinedAt;
  const lifecycleError = lifecycle?.error;
  const lifecycleReconnect = lifecycle?.reconnect;
  const networkOnline = network?.online;
  const networkLastChange = network?.lastChange;
  const networkWhy = network?.why;

  useEffect(() => {
    if (!reportFrom || !clearFrom) return;
    if (!room) {
      clearFrom(owner.current!);
      return;
    }
    reportFrom(owner.current!, { room, lifecycle, network });
  }, [
    clearFrom,
    lifecycle,
    lifecycleError,
    lifecycleJoinedAt,
    lifecycleReconnect,
    lifecycleStatus,
    network,
    networkLastChange,
    networkOnline,
    networkWhy,
    reportFrom,
    room,
    roomDeviceId,
    roomDoc,
    roomId,
    roomPeerCount,
    roomPeerId,
    roomProvider,
  ]);

  // An unmounted feature must not leave its last connection in shell chrome.
  // `clearFrom` is ownership-aware, so it cannot clear a newer feature's room.
  useEffect(
    () => () => {
      clearFrom?.(owner.current!);
    },
    [clearFrom],
  );

  return null;
}
