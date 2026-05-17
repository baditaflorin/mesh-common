import { useEffect, useState } from "react";

/**
 * Shared iOS-friendly DeviceMotionEvent listener with permission gate.
 *
 * Used internally by `useShake` and `useStepCount`. Apps should pair with
 * `<ArmGate>` so the user-gesture-required permission prompt fires on tap.
 *
 *   <ArmGate label="enable motion">
 *     {(armed) => armed && <MyShakeApp />}
 *   </ArmGate>
 *
 * Returns the latest event + smoothed magnitude. Magnitude is computed from
 * `accelerationIncludingGravity` minus 1g, so a still phone reads ~0.
 */
export type MotionSample = {
  /** ax, ay, az from accelerationIncludingGravity (m/s²). */
  ax: number;
  ay: number;
  az: number;
  /** Smoothed |a| − g (m/s²). 0 at rest, spikes during shake. */
  magnitude: number;
  /** Timestamp in ms (Date.now() at sample). */
  ts: number;
};

export function useDeviceMotion(opts?: { armed?: boolean }): {
  sample: MotionSample;
  supported: boolean;
  error: string | null;
} {
  const armed = opts?.armed ?? true;
  const supported =
    typeof window !== "undefined" && typeof window.DeviceMotionEvent !== "undefined";
  const [sample, setSample] = useState<MotionSample>({
    ax: 0,
    ay: 0,
    az: 0,
    magnitude: 0,
    ts: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!armed || !supported) return;
    let cancelled = false;
    let smoothed = 0;
    const handler = (e: DeviceMotionEvent) => {
      if (cancelled) return;
      const a = e.accelerationIncludingGravity;
      const ax = a?.x ?? 0;
      const ay = a?.y ?? 0;
      const az = a?.z ?? 0;
      const mag = Math.max(0, Math.sqrt(ax * ax + ay * ay + az * az) - 9.81);
      smoothed = smoothed * 0.6 + mag * 0.4;
      setSample({ ax, ay, az, magnitude: smoothed, ts: Date.now() });
    };
    (async () => {
      try {
        const ReqPerm = (
          window.DeviceMotionEvent as unknown as {
            requestPermission?: () => Promise<"granted" | "denied">;
          }
        ).requestPermission;
        if (typeof ReqPerm === "function") {
          const perm = await ReqPerm();
          if (cancelled) return;
          if (perm !== "granted") {
            setError("motion permission denied");
            return;
          }
        }
        window.addEventListener("devicemotion", handler);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("devicemotion", handler);
    };
  }, [armed, supported]);

  return { sample, supported, error };
}
