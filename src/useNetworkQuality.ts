import { useEffect, useMemo, useRef, useState } from "react";
import { useAwareness } from "./useAwareness";
import type { YRoom } from "./useYRoom";

/**
 * Per-peer round-trip latency over awareness. Each peer periodically writes
 * a `pingNonce` + `pingAt` into awareness; when another peer sees it they
 * write `pongNonce` + `pongAt` back. The originator measures RTT on the
 * pong's local arrival time.
 *
 *   const { rtts, median, mine } = useNetworkQuality(room);
 *   <RttBar value={median} />
 *
 * Honest framing:
 *  - This is approximate (awareness round-trips include broadcast jitter).
 *  - Useful for "should we degrade animations / disable cursors?" decisions,
 *    not for SLA dashboards.
 *  - Awareness ping payload is < 80 bytes; back-off ramps up when idle.
 */

export type NetworkQualityState = {
  /** Peer → RTT in ms (others only). */
  rtts: Record<string, number>;
  /** Median across all known peers (0 if no data yet). */
  median: number;
  /** Local peer's last ping send timestamp. */
  mine: number | null;
};

export type NetworkQualityOptions = {
  /** ms between pings when peers are active. Default 5_000. */
  intervalMs?: number;
  /** ms between pings when only one peer. Default 30_000. */
  idleIntervalMs?: number;
  /** Discard RTT samples older than N ms when computing median. Default 30_000. */
  staleAfterMs?: number;
};

type PingState = {
  pingNonce?: string;
  pingAt?: number;
  pongNonce?: string;
  pongAt?: number;
};

function newNonce(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useNetworkQuality(
  room: YRoom | null,
  opts?: NetworkQualityOptions,
): NetworkQualityState {
  const interval = opts?.intervalMs ?? 5_000;
  const idleInterval = opts?.idleIntervalMs ?? 30_000;
  const staleAfterMs = opts?.staleAfterMs ?? 30_000;

  const awareness = useAwareness<PingState>(room);
  const [rtts, setRtts] = useState<Record<string, { value: number; at: number }>>({});
  const lastNonce = useRef<string | null>(null);
  const lastSentAt = useRef<number | null>(null);

  // Periodic ping
  useEffect(() => {
    if (!room) return;
    const tick = () => {
      const nonce = newNonce();
      lastNonce.current = nonce;
      lastSentAt.current = Date.now();
      awareness.setLocal({ pingNonce: nonce, pingAt: Date.now() });
    };
    tick();
    const peers = awareness.peers.size;
    const dt = peers > 0 ? interval : idleInterval;
    const id = setInterval(tick, dt);
    return () => clearInterval(id);
  }, [room, awareness, interval, idleInterval, awareness.peers.size]);

  // Observe peers
  useEffect(() => {
    if (!room) return;
    const next: Record<string, { value: number; at: number }> = { ...rtts };
    let changed = false;
    for (const [peerId, s] of awareness.peers.entries()) {
      if (!s) continue;

      // If a peer pinged us, we owe them a pong (carry their nonce + a fresh pongAt).
      if (s.pingNonce && s.pingAt) {
        const existing = awareness.local ?? ({} as PingState);
        if (existing.pongNonce !== s.pingNonce) {
          awareness.setLocal({
            pongNonce: s.pingNonce,
            pongAt: Date.now(),
          });
        }
      }

      // If a peer pong'd our last ping, compute RTT.
      if (
        s.pongNonce &&
        lastNonce.current &&
        s.pongNonce === lastNonce.current &&
        lastSentAt.current
      ) {
        const value = Date.now() - lastSentAt.current;
        const prev = next[peerId];
        if (!prev || prev.value !== value) {
          next[peerId] = { value, at: Date.now() };
          changed = true;
        }
      }
    }
    if (changed) setRtts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, awareness.peers, awareness.local]);

  const result = useMemo<NetworkQualityState>(() => {
    const cutoff = Date.now() - staleAfterMs;
    const fresh: Record<string, number> = {};
    const values: number[] = [];
    for (const [peerId, { value, at }] of Object.entries(rtts)) {
      if (at < cutoff) continue;
      fresh[peerId] = value;
      values.push(value);
    }
    values.sort((a, b) => a - b);
    const median =
      values.length === 0
        ? 0
        : values.length % 2
          ? values[(values.length - 1) >> 1]!
          : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2;
    return { rtts: fresh, median, mine: lastSentAt.current };
  }, [rtts, staleAfterMs]);

  return result;
}
