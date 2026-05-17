import { useEffect, useRef, useState } from "react";
import { useDeviceMotion } from "./useDeviceMotion";

export type ShakeState = {
  /** Total shake count since mount. */
  shakes: number;
  /** ms since last detected shake (Infinity if none yet). */
  msSinceLastShake: number;
  /** Smoothed magnitude (m/s² above 1g). 0 at rest. */
  magnitude: number;
  /** True iff DeviceMotion is available + armed. */
  ready: boolean;
  /** Most recent error (e.g. permission denied). */
  error: string | null;
};

/**
 * Shake detector on top of DeviceMotion. Counts a shake when smoothed
 * magnitude crosses `threshold` and `cooldownMs` has passed since the last
 * one. Powers shake-to-roll, magic-8-ball, dice, ice-breaker, defibrillator
 * games. iOS Safari requires the user-gesture permission flow — pair with
 * `<ArmGate>`.
 *
 *   <ArmGate label="enable shake">
 *     {(armed) => armed && <ShakeRoller />}
 *   </ArmGate>
 *   // inside:
 *   const { shakes, magnitude } = useShake({ threshold: 14 });
 */
export function useShake(opts?: {
  armed?: boolean;
  threshold?: number;
  cooldownMs?: number;
}): ShakeState {
  const armed = opts?.armed ?? true;
  const threshold = opts?.threshold ?? 14;
  const cooldownMs = opts?.cooldownMs ?? 400;
  const { sample, supported, error } = useDeviceMotion({ armed });
  const [shakes, setShakes] = useState(0);
  const [lastShakeAt, setLastShakeAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const lastRef = useRef(0);

  useEffect(() => {
    if (sample.magnitude > threshold && Date.now() - lastRef.current > cooldownMs) {
      lastRef.current = Date.now();
      setShakes((n) => n + 1);
      setLastShakeAt(Date.now());
    }
  }, [sample.magnitude, threshold, cooldownMs]);

  useEffect(() => {
    if (!armed) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [armed]);

  return {
    shakes,
    msSinceLastShake: lastShakeAt === 0 ? Infinity : now - lastShakeAt,
    magnitude: sample.magnitude,
    ready: armed && supported && !error,
    error,
  };
}
