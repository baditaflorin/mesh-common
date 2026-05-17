import { useDeviceOrientation } from "./useDeviceOrientation";

export type TiltState = {
  /** Raw alpha (z-rotation, compass-ish). */
  alpha: number | null;
  /** Raw beta (x-rotation, front-to-back). */
  beta: number | null;
  /** Raw gamma (y-rotation, left-to-right). */
  gamma: number | null;
  /**
   * Normalized {x, y} in [-1, 1] suitable for driving a 2D control. Maps
   * beta/45° → y, gamma/45° → x, clamped.
   */
  x: number;
  y: number;
  /** True iff orientation is being received. */
  ready: boolean;
  /** Most recent error. */
  error: string | null;
};

/**
 * 2D tilt control. Powers level, marble-maze, pose-mirror, balance-game.
 * iOS Safari: pair with `<ArmGate>` to satisfy the user-gesture rule.
 *
 *   const { x, y } = useTilt();
 *   // Move a marker:
 *   <div style={{ transform: `translate(${x*100}%, ${y*100}%)` }}/>
 */
export function useTilt(opts?: { armed?: boolean; rangeDeg?: number }): TiltState {
  const armed = opts?.armed ?? true;
  const range = opts?.rangeDeg ?? 45;
  const o = useDeviceOrientation({ armed });
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    alpha: o.alpha,
    beta: o.beta,
    gamma: o.gamma,
    x: clamp((o.gamma ?? 0) / range),
    y: clamp((o.beta ?? 0) / range),
    ready: o.ready,
    error: o.error,
  };
}
