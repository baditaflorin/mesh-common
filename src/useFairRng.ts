import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";
import { combineSalts, randomSalt } from "./commitReveal";

export type FairRng = {
  /** Combined-salts seed in [0, 1), or null if no salts yet. */
  seed: number | null;
  /** True iff at least `minContributors` peers have contributed salts. */
  ready: boolean;
  /** How many peers have contributed. */
  contributors: number;
  /** Deterministic Fisher-Yates shuffle. Pure — same input + seed = same output. */
  shuffle: <T>(arr: readonly T[]) => T[];
  /** Pick one item deterministically. */
  pick: <T>(arr: readonly T[]) => T | null;
  /** Bump the round: drop our salt and contribute a fresh one. */
  rerollMine: () => void;
};

/**
 * Fair RNG — every peer contributes a random salt to a shared Y.Map, then
 * `combineSalts()` XORs them into a single seed everyone agrees on. Powers
 * fortune-cookie, secret-mission, uno-lite deck shuffle, fair-team draws.
 *
 * Trade-off vs. one peer rolling alone: nobody can bias the outcome, but the
 * "result" only stabilizes after the salts gather. Pair with a `usePhase`
 * gate so the app waits for `ready` before revealing.
 */
export function useFairRng(
  room: YRoom | null,
  key: string,
  opts?: { minContributors?: number; autoContribute?: boolean },
): FairRng {
  const minContributors = opts?.minContributors ?? 1;
  const autoContribute = opts?.autoContribute !== false;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<string>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    // Auto-contribute our salt the first time the room is available
    if (autoContribute && !m.has(room.peerId)) {
      m.set(room.peerId, randomSalt());
    }
    return () => m.unobserve(cb);
  }, [room, key, autoContribute]);

  const map = room ? room.doc.getMap<string>(key) : null;
  const salts: string[] = [];
  if (map) map.forEach((v) => salts.push(v));
  const contributors = salts.length;
  const ready = contributors >= minContributors;
  const seed = contributors > 0 ? combineSalts(salts) : null;

  // Lazy seeded PRNG (mulberry32-ish) — deterministic from the seed.
  const makePrng = (seed: number) => {
    let s = Math.floor(seed * 0xffffffff) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    if (seed === null) return out;
    const rng = makePrng(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  };

  const pick = <T,>(arr: readonly T[]): T | null => {
    if (seed === null || arr.length === 0) return null;
    const rng = makePrng(seed);
    return arr[Math.floor(rng() * arr.length)] as T;
  };

  const rerollMine = () => {
    if (!map || !room) return;
    map.set(room.peerId, randomSalt());
  };

  return { seed, ready, contributors, shuffle, pick, rerollMine };
}
