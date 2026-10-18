/**
 * Mesh clock sync — each peer publishes its local time via Yjs awareness; we
 * compute a running offset to mesh-median time. Not NTP-grade, but stable to
 * ~10–30 ms once a few rounds have settled.
 *
 * The median includes this peer's own clock (offset 0). Without it, two
 * peers would each adopt the other's clock and stay apart by their skew;
 * with it, every peer takes the median of the same set of clocks.
 */

import type { WebrtcProvider } from "y-webrtc";
import { now as defaultNow } from "./useFakeTime";

const PING_INTERVAL_MS = 1500;
const SAMPLE_TTL_MS = 5000;
/** Peers further off than this are broken or hostile; their clocks are ignored. */
const MAX_OFFSET_MS = 10 * 60 * 1000;

type Sample = { t: number; offset: number; receivedAt: number };

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
    return { meshNow: () => defaultNow(), destroy: () => undefined, peerCount: () => 0 };
  }

  const awareness = (provider as unknown as { awareness: Awareness }).awareness;
  const samples = new Map<number, Sample>();

  const publish = () => {
    awareness.setLocalStateField("clock", { t: defaultNow() });
  };

  const onChange = () => {
    const now = defaultNow();
    const states = awareness.getStates();
    samples.forEach((_, id) => {
      if (!states.has(id)) samples.delete(id);
    });
    states.forEach((state, id) => {
      if (id === awareness.clientID) return;
      const clock = state["clock"] as { t?: number } | undefined;
      const t = clock?.t;
      if (typeof t !== "number" || !Number.isFinite(t)) return;
      // Only a new timestamp is a new sample. Re-reading an unchanged `t`
      // against a later `now` would drag the offset down by up to one ping
      // interval and keep a silent peer's sample looking fresh forever.
      if (samples.get(id)?.t === t) return;
      const offset = t - now;
      if (Math.abs(offset) > MAX_OFFSET_MS) {
        samples.delete(id);
        return;
      }
      samples.set(id, { t, offset, receivedAt: now });
    });
  };

  publish();
  onChange();

  const pingTimer = setInterval(publish, PING_INTERVAL_MS);
  awareness.on("change", onChange);

  const meshNow = () => {
    const cutoff = defaultNow() - SAMPLE_TTL_MS;
    const offsets: number[] = [0]; // this peer's own clock
    samples.forEach((s) => {
      if (s.receivedAt >= cutoff) offsets.push(s.offset);
    });
    if (offsets.length === 1) return defaultNow();
    offsets.sort((a, b) => a - b);
    const mid = Math.floor(offsets.length / 2);
    const median =
      offsets.length % 2 === 1
        ? (offsets[mid] ?? 0)
        : ((offsets[mid - 1] ?? 0) + (offsets[mid] ?? 0)) / 2;
    return defaultNow() + median;
  };

  const destroy = () => {
    clearInterval(pingTimer);
    awareness.off("change", onChange);
  };

  const peerCount = () => samples.size;

  return { meshNow, destroy, peerCount };
}
