import { useCallback, useEffect, useState } from "react";

export type OrientationLockApi = {
  supported: boolean;
  orientation: string | null;
  error: Error | null;
  lock: (orientation: OrientationLockTarget) => Promise<boolean>;
  unlock: () => void;
};

export type OrientationLockTarget =
  | "any"
  | "natural"
  | "landscape"
  | "landscape-primary"
  | "landscape-secondary"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: OrientationLockTarget) => Promise<void>;
};

/** Screen-orientation lock with a safe unsupported fallback. */
export function useOrientationLock(): OrientationLockApi {
  const screenOrientation = typeof screen === "undefined" ? null : screen.orientation as LockableScreenOrientation;
  const supported = Boolean(screenOrientation?.lock && screenOrientation?.unlock);
  const [orientation, setOrientation] = useState<string | null>(() => screenOrientation?.type ?? null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!screenOrientation) return;
    const update = () => setOrientation(screenOrientation.type);
    screenOrientation.addEventListener("change", update);
    return () => screenOrientation.removeEventListener("change", update);
  }, [screenOrientation]);
  const lock = useCallback(async (next: OrientationLockTarget) => {
    if (!screenOrientation?.lock) {
      setError(new Error("screen orientation lock not supported"));
      return false;
    }
    try {
      await screenOrientation.lock(next);
      setOrientation(screenOrientation.type);
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
      return false;
    }
  }, [screenOrientation]);
  const unlock = useCallback(() => { try { screenOrientation?.unlock?.(); setError(null); } catch (cause) { setError(cause instanceof Error ? cause : new Error(String(cause))); } }, [screenOrientation]);
  return { supported, orientation, error, lock, unlock };
}
