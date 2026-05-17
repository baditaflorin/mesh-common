import { useEffect, useState } from "react";

export type Orientation = {
  /** Z-axis rotation (compass-ish, 0..360 — but unreferenced to true north). */
  alpha: number | null;
  /** X-axis rotation, front-to-back (−180..180). */
  beta: number | null;
  /** Y-axis rotation, left-to-right (−90..90). */
  gamma: number | null;
  /** iOS-only: heading vs magnetic north (0..360). */
  webkitCompassHeading: number | null;
  /** True iff DeviceOrientation is available + armed. */
  ready: boolean;
  /** Most recent error (e.g. permission denied). */
  error: string | null;
};

/**
 * Shared iOS-friendly DeviceOrientationEvent listener with permission gate.
 *
 * Used by `useTilt` and `useCompass`. Pair with `<ArmGate>` so the user
 * gesture fires the iOS permission prompt.
 */
export function useDeviceOrientation(opts?: { armed?: boolean }): Orientation {
  const armed = opts?.armed ?? true;
  const supported =
    typeof window !== "undefined" && typeof window.DeviceOrientationEvent !== "undefined";
  const [data, setData] = useState<
    Pick<Orientation, "alpha" | "beta" | "gamma" | "webkitCompassHeading">
  >({
    alpha: null,
    beta: null,
    gamma: null,
    webkitCompassHeading: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!armed || !supported) return;
    let cancelled = false;
    const handler = (e: DeviceOrientationEvent) => {
      if (cancelled) return;
      setData({
        alpha: e.alpha,
        beta: e.beta,
        gamma: e.gamma,
        webkitCompassHeading: (e as unknown as { webkitCompassHeading?: number })
          .webkitCompassHeading ?? null,
      });
    };
    (async () => {
      try {
        const ReqPerm = (
          window.DeviceOrientationEvent as unknown as {
            requestPermission?: () => Promise<"granted" | "denied">;
          }
        ).requestPermission;
        if (typeof ReqPerm === "function") {
          const perm = await ReqPerm();
          if (cancelled) return;
          if (perm !== "granted") {
            setError("orientation permission denied");
            return;
          }
        }
        window.addEventListener("deviceorientation", handler);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("deviceorientation", handler);
    };
  }, [armed, supported]);

  return { ...data, ready: armed && supported && !error, error };
}
