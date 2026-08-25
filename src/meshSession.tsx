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
import type { YRoom } from "./useYRoom";

/**
 * The visibility/activity state of one browser session. This intentionally
 * says nothing about a person or a physical phone: Safari, Chrome, and two
 * tabs on the same handset are distinct sessions.
 */
export type MeshSessionActivity = "active" | "hidden" | "unknown";

export type MeshSessionIdentity = {
  /** Ephemeral room-session id. This is normally `YRoom.peerId`. */
  sessionId: string;
  /**
   * Stable id from this app/browser storage namespace when the room exposes
   * one. It can dedupe a refreshed tab, but is not a hardware identifier.
   */
  deviceId?: string;
  /** Current room scope, when joined. */
  roomId?: string;
  /** Last local interaction or visibility restoration, in milliseconds. */
  lastActiveAt: number;
  activity: MeshSessionActivity;
  /** Record an intentional local interaction without publishing any data. */
  markActive: () => void;
};

export type MeshSessionOptions = {
  /** Inject a clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
  /**
   * Listen for local focus/keyboard/pointer visibility signals. Defaults to
   * true. Disable for an explicitly app-managed activity policy.
   */
  trackActivity?: boolean;
};

export type MeshSessionProviderProps = MeshSessionOptions & {
  room: YRoom | null;
  children: ReactNode;
};

let fallbackSessionSequence = 0;

function createFallbackSessionId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function")
    return `local-${randomUuid.call(globalThis.crypto)}`;
  fallbackSessionSequence += 1;
  return `local-${Date.now().toString(36)}-${fallbackSessionSequence.toString(36)}`;
}

function browserActivity(): MeshSessionActivity {
  if (typeof document === "undefined") return "unknown";
  return document.visibilityState === "hidden" ? "hidden" : "active";
}

/**
 * Compare only explicit browser-scoped IDs. A positive result means two
 * sessions share the same persisted app/browser identifier; it must never be
 * rendered or interpreted as a claim that they are the same physical device.
 */
export function sharesKnownBrowserDevice(
  first: Pick<MeshSessionIdentity, "deviceId"> | null | undefined,
  second: Pick<MeshSessionIdentity, "deviceId"> | null | undefined,
): boolean {
  return Boolean(
    first?.deviceId && second?.deviceId && first.deviceId === second.deviceId,
  );
}

/**
 * Local session and activity metadata for honest presence UI. The hook does
 * not write to awareness/CRDT state; apps can decide whether activity should
 * ever be shared and under which privacy rules.
 */
export function useMeshSession(
  room: YRoom | null,
  options: MeshSessionOptions = {},
): MeshSessionIdentity {
  const now = options.now ?? Date.now;
  const trackActivity = options.trackActivity ?? true;
  const fallbackId = useRef<string | null>(null);
  if (!fallbackId.current) fallbackId.current = createFallbackSessionId();

  const [lastActiveAt, setLastActiveAt] = useState(() => now());
  const [activity, setActivity] =
    useState<MeshSessionActivity>(browserActivity);
  const lastRecorded = useRef(lastActiveAt);

  const markActive = useCallback(() => {
    const next = now();
    // Pointer move/focus can be noisy. Keeping the largest timestamp also
    // protects injected/non-monotonic test clocks from moving activity back.
    if (next >= lastRecorded.current) {
      lastRecorded.current = next;
      setLastActiveAt(next);
    }
    setActivity("active");
  }, [now]);

  useEffect(() => {
    if (
      !trackActivity ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    )
      return;
    const onVisible = () => {
      const nextActivity = browserActivity();
      setActivity(nextActivity);
      if (nextActivity === "active") markActive();
    };
    const onInteraction = () => markActive();
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction);
    window.addEventListener("focus", onInteraction);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      window.removeEventListener("focus", onInteraction);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [markActive, trackActivity]);

  return useMemo(
    () => ({
      sessionId: room?.peerId ?? fallbackId.current!,
      deviceId: room?.deviceId,
      roomId: room?.roomId,
      lastActiveAt,
      activity,
      markActive,
    }),
    [
      activity,
      lastActiveAt,
      markActive,
      room?.deviceId,
      room?.peerId,
      room?.roomId,
    ],
  );
}

const MeshSessionContext = createContext<MeshSessionIdentity | null>(null);

/** Provides one app's local session metadata to its shell and feature views. */
export function MeshSessionProvider({
  room,
  children,
  now,
  trackActivity,
}: MeshSessionProviderProps) {
  const session = useMeshSession(room, { now, trackActivity });
  return (
    <MeshSessionContext.Provider value={session}>
      {children}
    </MeshSessionContext.Provider>
  );
}

/** Read session metadata from the nearest `MeshSessionProvider`, if present. */
export function useMeshSessionContext(): MeshSessionIdentity | null {
  return useContext(MeshSessionContext);
}
