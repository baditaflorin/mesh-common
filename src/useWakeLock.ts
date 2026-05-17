import { useCallback, useEffect, useRef, useState } from "react";

export type WakeLockState = {
  /** True iff Wake Lock API is available. */
  supported: boolean;
  /** True iff the wake lock is currently held. */
  active: boolean;
  /** Most recent error. */
  error: string | null;
  /** Request the wake lock. */
  acquire: () => Promise<void>;
  /** Release the wake lock. */
  release: () => Promise<void>;
};

/**
 * Screen Wake Lock — keep the display on. Critical for "set the phone on
 * the table" apps (live-poll, mood-ring, show-of-hands, attendance).
 *
 * The browser auto-releases the lock when the tab is backgrounded; this hook
 * re-acquires when visibility returns to foreground if `autoReacquire: true`
 * (default).
 *
 *   const wl = useWakeLock({ acquireOnMount: true });
 *
 * iOS Safari 16.4+ supports Screen Wake Lock.
 */
export function useWakeLock(opts?: {
  acquireOnMount?: boolean;
  autoReacquire?: boolean;
}): WakeLockState {
  const acquireOnMount = opts?.acquireOnMount ?? false;
  const autoReacquire = opts?.autoReacquire ?? true;
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const supported =
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof (navigator as Navigator & { wakeLock?: { request: unknown } }).wakeLock?.request ===
      "function";
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback(async () => {
    if (!supported) {
      setError("wake lock not supported");
      return;
    }
    try {
      const wl = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      sentinelRef.current = wl;
      setActive(true);
      setError(null);
      wl.addEventListener("release", () => {
        setActive(false);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [supported]);

  const release = useCallback(async () => {
    const wl = sentinelRef.current;
    if (!wl) return;
    try {
      await wl.release();
    } catch {
      /* already released */
    }
    sentinelRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    if (acquireOnMount) void acquire();
    return () => {
      void release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoReacquire) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && !active && sentinelRef.current == null) {
        if (acquireOnMount) void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [autoReacquire, acquireOnMount, active, acquire]);

  return { supported, active, error, acquire, release };
}
