import { useDeviceOrientation } from "./useDeviceOrientation";

export type CompassState = {
  /** Heading in degrees, 0..360 (0 = north). null if not yet known. */
  heading: number | null;
  /** Cardinal label: N, NE, E, SE, S, SW, W, NW. null if unknown. */
  cardinal: string | null;
  /** True iff orientation events are flowing. */
  ready: boolean;
  /** Most recent error. */
  error: string | null;
};

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/**
 * Compass heading on top of DeviceOrientation. iOS Safari provides true-ish
 * heading via `webkitCompassHeading`; other browsers report magnetic-ish
 * heading via `alpha` (already 0=north convention on most). Pair with
 * `<ArmGate>` for iOS permission.
 *
 *   const { heading, cardinal } = useCompass();
 *   <p>facing {cardinal} ({heading}°)</p>
 */
export function useCompass(opts?: { armed?: boolean }): CompassState {
  const o = useDeviceOrientation(opts);
  let heading: number | null = null;
  if (o.webkitCompassHeading != null) {
    heading = o.webkitCompassHeading;
  } else if (o.alpha != null) {
    // Most non-iOS browsers report alpha with 0 = north (compass-heading
    // convention) — fall back to that.
    heading = (360 - o.alpha) % 360;
  }
  const cardinal =
    heading == null ? null : CARDINALS[Math.round(heading / 45) % 8] ?? null;

  return {
    heading: heading == null ? null : Math.round(heading),
    cardinal,
    ready: o.ready,
    error: o.error,
  };
}
