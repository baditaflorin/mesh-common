import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type PhaseState<S extends string> = {
  /** Current phase. */
  phase: S;
  /** Transition to `next`. Optionally only if currently in one of `from`. */
  transition: (next: S, opts?: { from?: S | S[] }) => boolean;
  /** Convenience predicate. */
  isPhase: (p: S) => boolean;
  /** Mesh-synced epoch counter — increments on every transition. */
  epoch: number;
};

/**
 * Finite-state machine in `Y.Map`. Stores `{phase: S, epoch: number, at: ms}`
 * under the supplied key. Apps that have explicit rounds, lobby/draw/reveal
 * cycles, or any "next stage" flow should use this instead of an ad-hoc Y.Map.
 *
 * Provides guarded transitions (`opts.from`) so peers can race-safely advance
 * the state — only the transition that observes the matching current phase
 * wins on merge.
 */
export function usePhase<S extends string>(
  room: YRoom | null,
  key: string,
  initial: S,
): PhaseState<S> {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<string | number>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  const map = room ? room.doc.getMap<string | number>(key) : null;
  const phase = ((map?.get("phase") as S | undefined) ?? initial) as S;
  const epoch = (map?.get("epoch") as number | undefined) ?? 0;

  return {
    phase,
    epoch,
    isPhase: (p) => phase === p,
    transition: (next, opts) => {
      if (!map) return false;
      const cur = (map.get("phase") as S | undefined) ?? initial;
      if (opts?.from !== undefined) {
        const allowed = Array.isArray(opts.from) ? opts.from : [opts.from];
        if (!allowed.includes(cur)) return false;
      }
      if (cur === next) return false;
      const curEpoch = (map.get("epoch") as number | undefined) ?? 0;
      room!.doc.transact(() => {
        map.set("phase", next);
        map.set("epoch", curEpoch + 1);
        map.set("at", Date.now());
      });
      return true;
    },
  };
}
