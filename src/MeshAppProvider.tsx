import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MeshConfig } from "./MeshConfig";
import type { NetworkOnlineState } from "./useNetworkOnline";
import type { RoomLifecycle } from "./useRoomLifecycle";
import type { YRoom } from "./useYRoom";

/** A deliberately small adapter for an application's own toast system. */
export type MeshToastController = {
  /** Announce a short-lived, local UI message. */
  push: (
    message: string,
    options?: { kind?: "info" | "success" | "warning" | "error" },
  ) => void;
};

/**
 * App-owned capability state. This is intentionally transport-agnostic so an
 * app can expose browser permissions, hardware readiness, or a custom
 * capability check without coupling its UI to a particular browser API.
 */
export type MeshAppCapabilityState = {
  status: "ready" | "pending" | "unavailable" | "denied" | "unknown";
  detail?: string;
};

export type MeshAppContextValue = {
  config: MeshConfig;
  room: YRoom | null;
  lifecycle: RoomLifecycle;
  network: NetworkOnlineState;
  /** Optional local toast bridge. No messages are sent to peers by this API. */
  toast?: MeshToastController;
  /** Optional app-level capability snapshot keyed by a stable capability id. */
  capabilities?: Readonly<Record<string, MeshAppCapabilityState>>;
};

export type MeshAppProviderProps = MeshAppContextValue & {
  children: ReactNode;
};

const MeshAppContext = createContext<MeshAppContextValue | null>(null);

/**
 * Shares the common app inputs with layout and readiness primitives.
 *
 * The provider owns no browser connection or permission effects: callers
 * continue to own `useYRoom`, `useRoomLifecycle`, and `useNetworkOnline`.
 * That keeps there being exactly one owner for every WebRTC provider and
 * network probe in an app.
 */
export function MeshAppProvider({
  config,
  room,
  lifecycle,
  network,
  toast,
  capabilities,
  children,
}: MeshAppProviderProps) {
  const value = useMemo<MeshAppContextValue>(
    () => ({ config, room, lifecycle, network, toast, capabilities }),
    [capabilities, config, lifecycle, network, room, toast],
  );

  return (
    <MeshAppContext.Provider value={value}>{children}</MeshAppContext.Provider>
  );
}

/** Returns the nearest mesh app context, or `null` outside a provider. */
export function useOptionalMeshApp(): MeshAppContextValue | null {
  return useContext(MeshAppContext);
}

/**
 * Returns the nearest mesh app context.
 *
 * Throwing here catches an accidental missing provider at the component
 * boundary instead of leaving a user with a silent, disconnected screen.
 */
export function useMeshApp(): MeshAppContextValue {
  const context = useOptionalMeshApp();
  if (!context) {
    throw new Error("useMeshApp must be used inside MeshAppProvider");
  }
  return context;
}
