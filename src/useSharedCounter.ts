import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type SharedCounterOptions = { min?: number; max?: number };
export type SharedCounter = {
  value: number;
  byPeer: Record<string, number>;
  increment: (amount?: number) => boolean;
  decrement: (amount?: number) => boolean;
  reset: () => void;
};

/**
 * A peer-attributed collaborative counter. Each peer only changes its own
 * contribution, so concurrent increments merge instead of overwriting.
 */
export function useSharedCounter(
  room: YRoom | null,
  key: string,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY }: SharedCounterOptions = {},
): SharedCounter {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<number>(key);
    const onChange = () => rerender((version) => version + 1);
    map.observe(onChange);
    return () => map.unobserve(onChange);
  }, [room, key]);

  const map = room?.doc.getMap<number>(key) ?? null;
  const byPeer: Record<string, number> = {};
  map?.forEach((value, peerId) => {
    if (typeof value === "number" && Number.isFinite(value)) byPeer[peerId] = value;
  });
  const value = Object.values(byPeer).reduce((total, contribution) => total + contribution, 0);
  const change = (amount: number) => {
    if (!room || !map || !Number.isFinite(amount)) return false;
    const next = value + amount;
    if (next < min || next > max) return false;
    map.set(room.peerId, (map.get(room.peerId) ?? 0) + amount);
    return true;
  };

  return {
    value,
    byPeer,
    increment: (amount = 1) => change(amount),
    decrement: (amount = 1) => change(-amount),
    reset: () => map?.clear(),
  };
}
