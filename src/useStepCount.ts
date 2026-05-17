import { useEffect, useRef, useState } from "react";
import { useDeviceMotion } from "./useDeviceMotion";

export type StepCountState = {
  /** Total step count since mount. */
  steps: number;
  /** Steps per minute (rolling 10s window). */
  cadence: number;
  /** Smoothed acceleration magnitude (m/s² above g). */
  magnitude: number;
  /** True iff DeviceMotion is flowing. */
  ready: boolean;
  /** Most recent error. */
  error: string | null;
  /** Reset the step counter. */
  reset: () => void;
};

/**
 * Step detection from accelerometer peaks. Heuristic: every time the
 * smoothed magnitude crosses the `threshold` upward and `minStepMs` has
 * passed since the last step, count one. Powers group-walk, race-to-N-steps,
 * fundraiser-mile, walk-while-debate.
 *
 * iOS Safari: pair with `<ArmGate>`.
 *
 *   const { steps, cadence } = useStepCount({ threshold: 1.5 });
 */
export function useStepCount(opts?: {
  armed?: boolean;
  threshold?: number;
  minStepMs?: number;
}): StepCountState {
  const armed = opts?.armed ?? true;
  const threshold = opts?.threshold ?? 1.5;
  const minStepMs = opts?.minStepMs ?? 280;
  const { sample, supported, error } = useDeviceMotion({ armed });
  const [steps, setSteps] = useState(0);
  const lastStepRef = useRef(0);
  const prevMagRef = useRef(0);
  const recentRef = useRef<number[]>([]);
  const [cadence, setCadence] = useState(0);

  useEffect(() => {
    const t = Date.now();
    const m = sample.magnitude;
    if (
      m > threshold &&
      prevMagRef.current <= threshold &&
      t - lastStepRef.current > minStepMs
    ) {
      lastStepRef.current = t;
      setSteps((n) => n + 1);
      const recent = recentRef.current;
      recent.push(t);
      const cutoff = t - 10_000;
      while (recent.length > 0 && recent[0]! < cutoff) recent.shift();
      setCadence(Math.round((recent.length / 10) * 60));
    }
    prevMagRef.current = m;
  }, [sample.magnitude, threshold, minStepMs]);

  return {
    steps,
    cadence,
    magnitude: sample.magnitude,
    ready: armed && supported && !error,
    error,
    reset: () => {
      setSteps(0);
      recentRef.current = [];
      setCadence(0);
    },
  };
}
