import { useEffect, useState } from "react";
import type { ClockSync } from "./clockSync";
import type { YRoom } from "./useYRoom";

export type ScheduledCue<T> = {
  /** Globally unique event id. Consumers should deduplicate side effects by this id. */
  id: string;
  /** Shared-clock time at which the local effect should fire. */
  fireAt: number;
  payload: T;
};

export type ScheduledCueState = "idle" | "scheduled" | "due" | "expired" | "cancelled";

export type ScheduledCueOptions<T> = {
  /** Shared mesh clock. Local wall time is used when omitted. */
  clock?: ClockSync | null;
  /** Reject schedules with less lead time. Default: 750ms. */
  minLeadMs?: number;
  /** Reject schedules farther away than this. Default: 60 seconds. */
  maxLeadMs?: number;
  /** A cue remains actionable for this long after `fireAt`. Default: 5 seconds. */
  graceMs?: number;
  /** UI refresh cadence while a cue is active. Default: 50ms. */
  tickMs?: number;
  /** Validate untrusted CRDT payloads at the framework edge. */
  isPayload?: (value: unknown) => value is T;
};

export type ScheduledCueController<T> = {
  cue: ScheduledCue<T> | null;
  state: ScheduledCueState;
  /** Positive before the event, zero once due or expired. */
  remainingMs: number | null;
  /** Positive after `fireAt`; useful for recording actual installation jitter. */
  latenessMs: number | null;
  /** Schedule a cue at an absolute shared-clock timestamp. */
  scheduleAt: (payload: T, fireAt: number) => boolean;
  /** Schedule a cue after a bounded delay on the shared clock. */
  scheduleIn: (payload: T, delayMs: number) => boolean;
  /** Cancel the current cue without losing an auditable terminal record. */
  cancel: () => boolean;
  /** Remove the current terminal record. Never clears a still-scheduled cue. */
  clear: () => boolean;
};

type CueRecord = {
  state: "scheduled" | "cancelled";
  id: string;
  fireAt: number;
  payload: unknown;
  cancelledAt?: number;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readCue<T>(raw: unknown, isPayload: (value: unknown) => value is T): CueRecord | null {
  if (!isPlainObject(raw)) return null;
  if (raw.state !== "scheduled" && raw.state !== "cancelled") return null;
  if (typeof raw.id !== "string" || raw.id.length === 0 || raw.id.length > 160) return null;
  if (typeof raw.fireAt !== "number" || !Number.isFinite(raw.fireAt)) return null;
  if (!isPayload(raw.payload)) return null;
  if (raw.cancelledAt !== undefined && (typeof raw.cancelledAt !== "number" || !Number.isFinite(raw.cancelledAt))) {
    return null;
  }
  return raw as CueRecord;
}

function cueId(room: YRoom, now: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${room.peerId}-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A small, one-shot, replicated cue. The CRDT carries only a timestamp and
 * validated payload: each participant schedules its local side effect against
 * the same clock. This keeps the hot path tiny and makes it suitable for
 * rehearsal-scale light, sound, or capture cues.
 *
 * It deliberately makes no promise about hardware driver latency or transport
 * scale. A 200-device installation can preserve this API while substituting a
 * coordinator relay for the room transport.
 */
export function useScheduledCue<T>(
  room: YRoom | null,
  key: string,
  options: ScheduledCueOptions<T> = {},
): ScheduledCueController<T> {
  const [, rerender] = useState(0);
  const minLeadMs = Math.max(0, Math.floor(options.minLeadMs ?? 750));
  const maxLeadMs = Math.max(minLeadMs, Math.floor(options.maxLeadMs ?? 60_000));
  const graceMs = Math.max(0, Math.floor(options.graceMs ?? 5_000));
  const tickMs = Math.max(16, Math.floor(options.tickMs ?? 50));
  const now = options.clock ? () => options.clock!.meshNow() : Date.now;
  const isPayload = options.isPayload ?? ((value: unknown): value is T => value !== undefined);

  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<unknown>(key);
    const onChange = () => rerender((version) => version + 1);
    map.observe(onChange);
    return () => map.unobserve(onChange);
  }, [room, key]);

  const map = room ? room.doc.getMap<unknown>(key) : null;
  const record = map ? readCue(map.get("current"), isPayload) : null;
  const cue = record ? { id: record.id, fireAt: record.fireAt, payload: record.payload as T } : null;
  const currentTime = now();
  const rawRemaining = cue ? cue.fireAt - currentTime : null;
  const latenessMs = cue && rawRemaining !== null && rawRemaining <= 0 ? Math.max(0, -rawRemaining) : null;
  const state: ScheduledCueState = !record
    ? "idle"
    : record.state === "cancelled"
      ? "cancelled"
      : rawRemaining !== null && rawRemaining > 0
        ? "scheduled"
        : latenessMs !== null && latenessMs <= graceMs
          ? "due"
          : "expired";

  useEffect(() => {
    if (state !== "scheduled" && state !== "due") return;
    const timer = window.setInterval(() => rerender((version) => version + 1), tickMs);
    return () => window.clearInterval(timer);
  }, [state, tickMs]);

  const write = (next: CueRecord) => {
    if (!map || !room) return false;
    room.doc.transact(() => map.set("current", next));
    return true;
  };

  const scheduleAt = (payload: T, fireAt: number) => {
    if (!room || !map || !isPayload(payload) || !Number.isFinite(fireAt)) return false;
    const delayMs = fireAt - now();
    if (delayMs < minLeadMs || delayMs > maxLeadMs) return false;
    return write({ state: "scheduled", id: cueId(room, now()), fireAt, payload });
  };

  return {
    cue,
    state,
    remainingMs: rawRemaining === null ? null : Math.max(0, rawRemaining),
    latenessMs,
    scheduleAt,
    scheduleIn: (payload, delayMs) => {
      if (!Number.isFinite(delayMs)) return false;
      return scheduleAt(payload, now() + delayMs);
    },
    cancel: () => {
      if (!record || record.state !== "scheduled") return false;
      return write({ ...record, state: "cancelled", cancelledAt: now() });
    },
    clear: () => {
      if (!map || !room || state === "scheduled" || state === "due") return false;
      room.doc.transact(() => map.delete("current"));
      return true;
    },
  };
}
