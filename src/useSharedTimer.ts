import { useEffect, useState } from "react";
import type { ClockSync } from "./clockSync";
import type { YRoom } from "./useYRoom";

export type SharedTimerStatus = "idle" | "running" | "paused" | "finished";

export type SharedTimer = {
  /** Current lifecycle state. `finished` is derived when a countdown reaches zero. */
  state: SharedTimerStatus;
  /** Configured countdown duration, or null for a stopwatch. */
  durationMs: number | null;
  /** Elapsed duration derived from the shared timestamp and the current clock. */
  elapsedMs: number;
  /** Countdown time left, or null for a stopwatch. */
  remainingMs: number | null;
  /** Start a fresh run, optionally replacing the configured countdown duration. */
  start: (durationMs?: number | null) => boolean;
  /** Freeze a running timer at its current elapsed value. */
  pause: () => boolean;
  /** Continue a paused timer from its persisted elapsed value. */
  resume: () => boolean;
  /** Return to idle at zero elapsed time, preserving its configured duration. */
  reset: () => boolean;
};

export type SharedTimerOptions = {
  /** Initial countdown length; omit or pass null for a stopwatch. */
  durationMs?: number | null;
  /** Shared mesh clock. Local wall time is used when omitted. */
  clock?: ClockSync | null;
  /** UI refresh cadence while running. Default: 250 ms. */
  tickMs?: number;
};

type TimerRecord = {
  status: "idle" | "running" | "paused";
  durationMs: number | null;
  elapsedMs: number;
  startedAt: number | null;
};

function validDuration(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function readRecord(map: ReturnType<YRoom["doc"]["getMap"]>, initialDuration: number | null): TimerRecord {
  const rawStatus = map.get("status");
  const rawDuration = map.get("durationMs");
  const rawElapsed = map.get("elapsedMs");
  const rawStartedAt = map.get("startedAt");
  return {
    status: rawStatus === "running" || rawStatus === "paused" ? rawStatus : "idle",
    durationMs: typeof rawDuration === "number" && validDuration(rawDuration) ? rawDuration : initialDuration,
    elapsedMs: typeof rawElapsed === "number" && Number.isFinite(rawElapsed) && rawElapsed >= 0 ? rawElapsed : 0,
    startedAt: typeof rawStartedAt === "number" && Number.isFinite(rawStartedAt) ? rawStartedAt : null,
  };
}

/**
 * Drift-free replicated countdown or stopwatch. The CRDT stores only lifecycle
 * timestamps and accumulated elapsed time; each peer derives its display from
 * a mesh clock, so no per-tick writes or network churn are required.
 */
export function useSharedTimer(
  room: YRoom | null,
  key: string,
  opts?: SharedTimerOptions,
): SharedTimer {
  const [, rerender] = useState(0);
  const initialDuration = validDuration(opts?.durationMs ?? null) ? (opts?.durationMs ?? null) : null;
  const tickMs = Math.max(50, opts?.tickMs ?? 250);
  const meshNow = opts?.clock ? () => opts.clock!.meshNow() : Date.now;

  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<unknown>(key);
    const onChange = () => rerender((version) => version + 1);
    map.observe(onChange);
    return () => map.unobserve(onChange);
  }, [room, key]);

  const map = room ? room.doc.getMap<unknown>(key) : null;
  const record = map ? readRecord(map, initialDuration) : {
    status: "idle" as const,
    durationMs: initialDuration,
    elapsedMs: 0,
    startedAt: null,
  };
  const now = meshNow();
  const uncappedElapsed =
    record.status === "running" && record.startedAt !== null
      ? record.elapsedMs + Math.max(0, now - record.startedAt)
      : record.elapsedMs;
  const elapsedMs = record.durationMs === null
    ? uncappedElapsed
    : Math.min(record.durationMs, uncappedElapsed);
  const finished = record.durationMs !== null && elapsedMs >= record.durationMs;
  const state: SharedTimerStatus = finished && record.status === "running" ? "finished" : record.status;
  const remainingMs = record.durationMs === null ? null : Math.max(0, record.durationMs - elapsedMs);

  useEffect(() => {
    if (state !== "running") return;
    const timer = setInterval(() => rerender((version) => version + 1), tickMs);
    return () => clearInterval(timer);
  }, [state, tickMs]);

  const write = (next: TimerRecord) => {
    if (!map || !room) return false;
    room.doc.transact(() => {
      map.set("status", next.status);
      map.set("durationMs", next.durationMs);
      map.set("elapsedMs", next.elapsedMs);
      map.set("startedAt", next.startedAt);
    });
    return true;
  };

  return {
    state,
    durationMs: record.durationMs,
    elapsedMs,
    remainingMs,
    start: (duration) => {
      const nextDuration = duration === undefined ? record.durationMs : duration;
      if (!validDuration(nextDuration)) return false;
      return write({ status: "running", durationMs: nextDuration, elapsedMs: 0, startedAt: meshNow() });
    },
    pause: () => {
      if (state !== "running") return false;
      return write({ status: "paused", durationMs: record.durationMs, elapsedMs, startedAt: null });
    },
    resume: () => {
      if (record.status !== "paused" || finished) return false;
      return write({ ...record, status: "running", startedAt: meshNow() });
    },
    reset: () => write({ status: "idle", durationMs: record.durationMs, elapsedMs: 0, startedAt: null }),
  };
}
