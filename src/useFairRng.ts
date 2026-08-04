import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";
import { useCommitRevealHook } from "./useCommitRevealHook";
import { combineSalts, randomSalt, verifyReveal } from "./commitReveal";

export type FairRng = {
  /** Combined-salts seed in [0, 1), derived only from verified reveals. Null until at least one lands. */
  seed: number | null;
  /** True iff every peer in `peerIds` has a verified reveal this round, and at least `minContributors` do. */
  ready: boolean;
  /** How many peers have a verified reveal this round. */
  contributors: number;
  /** Deterministic Fisher-Yates shuffle. Pure — same input + seed = same output. */
  shuffle: <T>(arr: readonly T[]) => T[];
  /** Pick one item deterministically. */
  pick: <T>(arr: readonly T[]) => T | null;
  /**
   * Start a fresh round for the whole room: bumps the round epoch, which
   * points every peer at brand-new (empty) commit/reveal maps. Everyone
   * blind-commits again before anyone reveals — this is a full-room reroll,
   * not a private redo of just your own salt.
   */
  rerollRound: () => void;
};

/**
 * Fair RNG — commit-reveal group entropy. Each peer first publishes
 * `sha256(salt|peerId-scoped-nonce)` (a commitment), and only once every
 * peer in `peerIds` has committed does it reveal its raw salt. Reveals that
 * don't match their earlier commitment are dropped. `combineSalts()` then
 * XORs the verified salts into a single seed everyone agrees on. Powers
 * fortune-cookie, secret-mission, uno-lite deck shuffle, fair-team draws.
 *
 * The commit-then-reveal ordering is the whole point: a peer must lock in
 * its salt *before* it can see anyone else's, so nobody can pick a salt that
 * steers the combined seed, and nobody can stall past their own commitment
 * to preview the result before deciding whether to reveal. `rerollRound()`
 * preserves that guarantee by resetting the whole room to a new blind round
 * rather than letting one peer swap out just their own contribution.
 *
 * `peerIds` should be the room's live roster (e.g. `useRoster().present`) —
 * it's the quorum `useFairRng` waits on before it will let anyone reveal.
 */
export function useFairRng(
  room: YRoom | null,
  key: string,
  opts: {
    /** Peers required to commit + reveal before the round is trusted. */
    peerIds: readonly string[];
    minContributors?: number;
    autoContribute?: boolean;
  },
): FairRng {
  const { peerIds } = opts;
  const minContributors = opts.minContributors ?? 1;
  const autoContribute = opts.autoContribute !== false;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<number>(`${key}:round`);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  const roundMap = room ? room.doc.getMap<number>(`${key}:round`) : null;
  const epoch = roundMap?.get("epoch") ?? 0;
  const roundKey = `${key}:${epoch}`;

  const cr = useCommitRevealHook<string>(room, "fair-rng", roundKey);

  // Auto-commit a fresh random salt for this round.
  useEffect(() => {
    if (!room || !autoContribute) return;
    if (cr.status !== "idle") return;
    void cr.commit(randomSalt());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, autoContribute, roundKey, cr.status]);

  const allCommitted =
    peerIds.length > 0 && peerIds.every((id) => Boolean(cr.entries[id]?.hash));

  // Reveal only once every currently-known peer has committed — this is the
  // quorum gate that stops a peer from watching others' salts land before
  // deciding whether (or how) to contribute its own.
  useEffect(() => {
    if (!room || !autoContribute) return;
    if (cr.status !== "committed") return;
    if (!allCommitted) return;
    void cr.reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, autoContribute, cr.status, allCommitted]);

  // Verify every peer's reveal against their earlier commitment before it's
  // allowed to influence the seed; a mismatched reveal is dropped rather
  // than combined. Depends on a stable snapshot key (not `cr.entries`
  // itself, which is a new object every render) so this only re-runs when
  // the underlying commit/reveal content actually changes.
  const entriesSnapshot = JSON.stringify(
    Object.entries(cr.entries).map(([id, e]) => [
      id,
      e.hash ?? null,
      e.reveal?.salt ?? null,
      e.reveal?.payload ?? null,
    ]),
  );
  const [verified, setVerified] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const pending = Object.entries(cr.entries).filter(([, e]) => e.hash && e.reveal);
    void (async () => {
      const next: Record<string, string> = {};
      for (const [id, e] of pending) {
        const ok = await verifyReveal(e.hash!, {
          salt: e.reveal!.salt,
          payload: JSON.stringify(e.reveal!.payload),
        });
        if (ok) next[id] = e.reveal!.payload;
      }
      if (!cancelled) setVerified(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesSnapshot]);

  const salts = peerIds.filter((id) => id in verified).map((id) => verified[id]!);
  const contributors = salts.length;
  const ready =
    peerIds.length > 0 &&
    peerIds.every((id) => id in verified) &&
    contributors >= minContributors;
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

  const rerollRound = () => {
    if (!room) return;
    const m = room.doc.getMap<number>(`${key}:round`);
    const cur = (m.get("epoch") as number | undefined) ?? 0;
    m.set("epoch", cur + 1);
  };

  return { seed, ready, contributors, shuffle, pick, rerollRound };
}
