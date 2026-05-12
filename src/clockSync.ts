/**
 * Mesh clock sync — each peer publishes its local time via Yjs awareness; we
 * compute a running offset to mesh-median time. Not NTP-grade, but stable to
 * ~10–30 ms once a few rounds have settled.
 */

import type { WebrtcProvider } from "y-webrtc";

const PING_INTERVAL_MS = 1500;
const SAMPLE_TTL_MS = 5000;

type Sample = { offset: number; receivedAt: number };

export type ClockSync = {
  meshNow: () => number;
  destroy: () => void;
  peerCount: () => number;
};

type Awareness = {
  clientID: number;
  setLocalStateField: (key: string, value: unknown) => void;
  getStates: () => Map<number, Record<string, unknown>>;
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
};

export function createClockSync(provider: WebrtcProvider | null): ClockSync {
  if (!provider) {
    return { meshNow: () => Date.now(), destroy: () => undefined, peerCount: () => 0 };
  }

  const awareness = (provider as unknown as { awareness: Awareness }).awareness;
  const samples = new Map<number, Sample>();

  const publish = () => {
    awareness.setLocalStateField("clock", { t: Date.now() });
  };

  const onChange = () => {
    const now = Date.now();
    const states = awareness.getStates();
    samples.forEach((_, id) => {
      if (!states.has(id)) samples.delete(id);
    });
    states.forEach((state, id) => {
      if (id === awareness.clientID) return;
      const clock = state["clock"] as { t?: number } | undefined;
      if (typeof clock?.t === "number") {
        samples.set(id, { offset: clock.t - now, receivedAt: now });
      }
    });
  };

  publish();
  onChange();

  const pingTimer = setInterval(publish, PING_INTERVAL_MS);
  awareness.on("change", onChange);

  const meshNow = () => {
    const cutoff = Date.now() - SAMPLE_TTL_MS;
    const offsets: number[] = [];
    samples.forEach((s) => {
      if (s.receivedAt >= cutoff) offsets.push(s.offset);
    });
    if (offsets.length === 0) return Date.now();
    offsets.sort((a, b) => a - b);
    const mid = Math.floor(offsets.length / 2);
    const median =
      offsets.length % 2 === 1
        ? (offsets[mid] ?? 0)
        : ((offsets[mid - 1] ?? 0) + (offsets[mid] ?? 0)) / 2;
    return Date.now() + median;
  };

  const destroy = () => {
    clearInterval(pingTimer);
    awareness.off("change", onChange);
  };

  const peerCount = () => samples.size;

  return { meshNow, destroy, peerCount };
}
