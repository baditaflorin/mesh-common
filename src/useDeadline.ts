import { useEffect, useState } from "react";
import type { ClockSync } from "./clockSync";

export type DeadlineState = {
  /** ms remaining (clamped to 0 once past). */
  remainingMs: number;
  /** True once `now >= targetTs`. */
  isPast: boolean;
  /** 0..1 fraction elapsed since `startTs` (only computed if `startTs` provided). */
  progress: number | null;
  /**
   * Smart-formatted countdown. `"now"` when isPast, `"4s"` under a minute,
   * `"1:23"` under an hour, `"02:15:09"` under a day, otherwise `"3 days"`.
   */
  fmt: string;
};

function format(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  const days = Math.floor(s / 86400);
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * One-shot countdown to an absolute mesh-time. Composable with `useMeshSlot`
 * (`useDeadline(slot.slotStart + slot.slotMs)`) or used directly with any
 * future epoch ms.
 *
 * Re-renders every `tickMs` (default 500 ms). Pass `clock` to use mesh-time
 * (recommended whenever the deadline is shared); falls back to `Date.now()`.
 */
export function useDeadline(
  targetTs: number | null,
  opts?: { clock?: ClockSync | null; startTs?: number; tickMs?: number },
): DeadlineState {
  const tickMs = opts?.tickMs ?? 500;
  const clock = opts?.clock ?? null;
  const [now, setNow] = useState<number>(() => (clock ? clock.meshNow() : Date.now()));

  useEffect(() => {
    if (targetTs == null) return;
    const id = setInterval(() => {
      setNow(clock ? clock.meshNow() : Date.now());
    }, tickMs);
    return () => clearInterval(id);
  }, [targetTs, clock, tickMs]);

  if (targetTs == null) {
    return { remainingMs: 0, isPast: false, progress: null, fmt: "" };
  }

  const remainingMs = Math.max(0, targetTs - now);
  const isPast = now >= targetTs;
  const progress =
    opts?.startTs != null
      ? Math.min(1, Math.max(0, (now - opts.startTs) / (targetTs - opts.startTs)))
      : null;

  return { remainingMs, isPast, progress, fmt: format(remainingMs) };
}
