import { useEffect, useState } from "react";
import type { ClockSync } from "./clockSync";

export type MeshSlot = {
  /** Slot ordinal — integer that ticks once every `slotMs`. */
  slotId: number;
  /** Mesh-clock ms at which the current slot started. */
  slotStart: number;
  /** Mesh-clock ms remaining until the current slot ends. */
  slotMsRemaining: number;
  /** The configured slot length, echoed back for convenience. */
  slotMs: number;
  /** 0..1 fraction of the current slot already elapsed. */
  progress: number;
};

/**
 * Rotating-slot clock — derives a deterministic slot ordinal from mesh-time.
 * Powers attendance-stamp (rotating QR), marathon-pacer (metronome ticks),
 * spotlight (rotating featured peer), debate-clock (alternating turns).
 *
 * Re-renders every 250 ms so countdown UIs stay live. Pass `tickMs` to slow
 * that down for low-energy apps.
 */
export function useMeshSlot(
  clock: ClockSync | null,
  slotMs: number,
  opts?: { tickMs?: number },
): MeshSlot {
  const tickMs = opts?.tickMs ?? 250;
  const [now, setNow] = useState<number>(() =>
    clock ? clock.meshNow() : Date.now(),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setNow(clock ? clock.meshNow() : Date.now());
    }, tickMs);
    return () => clearInterval(id);
  }, [clock, tickMs]);

  const slotId = Math.floor(now / slotMs);
  const slotStart = slotId * slotMs;
  const slotMsRemaining = Math.max(0, slotStart + slotMs - now);
  const progress = Math.min(1, Math.max(0, (now - slotStart) / slotMs));

  return { slotId, slotStart, slotMsRemaining, slotMs, progress };
}
