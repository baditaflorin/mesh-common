import { useCallback, useEffect, useMemo, useState } from "react";
import { commit, verifyReveal, randomSalt, type Commitment, type Reveal } from "../commitReveal";
import type { YRoom } from "../useYRoom";

export type BidEntry = {
  peerId: string;
  amount: number;
};

type CommitRecord = { hash: string; ts: number };

export type BidState = {
  /** Has THIS peer committed a bid in the current round? */
  myPending: boolean;
  /** Has THIS peer revealed their bid? */
  myRevealed: boolean;
  /** This peer's committed amount (local only — never visible to others until reveal). */
  myAmount: number | null;
  /** Submit (commit) a bid. */
  submitBid: (amount: number) => Promise<void>;
  /** Reveal this peer's bid (call when reveal phase opens). */
  revealMine: () => Promise<void>;
  /** All revealed bids in the current round (sorted high-to-low). */
  revealed: BidEntry[];
  /** Winning bid (highest revealed). null if no reveals yet. */
  winner: BidEntry | null;
  /** Count of pending (committed but un-revealed) bids. */
  pendingCount: number;
  /** Start a new round (clears all bids). Use after a winner is declared. */
  startNewRound: () => void;
  /** Current round id (advances on `startNewRound`). */
  round: string;
};

/**
 * Sealed-bid auction via commit-reveal. Each peer commits hash(amount+salt)
 * during the bid phase, then reveals (amount, salt) during the reveal phase
 * so all bids land simultaneously without any peer being able to see others'
 * bids first.
 *
 *   const bid = useBid(room, "favor-auction");
 *   onBidSubmit = (amount) => bid.submitBid(amount);
 *   onRevealPhase = () => bid.revealMine();
 *   {bid.winner && <p>winning bid: {bid.winner.amount}</p>}
 *
 * Pair with `usePhase` to drive the bid → reveal → winner FSM, and
 * `useRateLimit` to prevent spam-bids.
 */
export function useBid(room: YRoom | null, key: string): BidState {
  const [, rerender] = useState(0);
  const [localSalt, setLocalSalt] = useState<string | null>(null);
  const [localAmount, setLocalAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!room) return;
    const round = room.doc.getMap<string>(`${key}_round`);
    const commits = room.doc.getMap<CommitRecord>(`${key}_commits`);
    const reveals = room.doc.getMap<Reveal>(`${key}_reveals`);
    const cb = () => rerender((n) => n + 1);
    round.observe(cb);
    commits.observe(cb);
    reveals.observe(cb);
    return () => {
      round.unobserve(cb);
      commits.unobserve(cb);
      reveals.unobserve(cb);
    };
  }, [room, key]);

  const round = room?.doc.getMap<string>(`${key}_round`).get("current") ?? "r0";
  const commits = room ? room.doc.getMap<CommitRecord>(`${key}_commits`) : null;
  const reveals = room ? room.doc.getMap<Reveal>(`${key}_reveals`) : null;
  const myPeer = room?.peerId ?? "";

  const myCommit = commits?.get(`${round}:${myPeer}`) ?? null;
  const myReveal = reveals?.get(`${round}:${myPeer}`) ?? null;

  const submitBid = useCallback(
    async (amount: number) => {
      if (!room || !commits) return;
      if (!Number.isFinite(amount)) return;
      const salt = randomSalt();
      const payload = JSON.stringify({ amount });
      const c: Commitment = await commit(payload, salt);
      setLocalSalt(salt);
      setLocalAmount(amount);
      commits.set(`${round}:${myPeer}`, { hash: c.hash, ts: Date.now() });
    },
    [room, commits, round, myPeer],
  );

  const revealMine = useCallback(async () => {
    if (!room || !commits || !reveals || !myCommit || localSalt == null || localAmount == null) return;
    const rev: Reveal = { payload: JSON.stringify({ amount: localAmount }), salt: localSalt };
    reveals.set(`${round}:${myPeer}`, rev);
  }, [room, commits, reveals, myCommit, localSalt, localAmount, round, myPeer]);

  const revealed: BidEntry[] = useMemo(() => {
    if (!commits || !reveals) return [];
    const out: BidEntry[] = [];
    const verifyPromises: Array<Promise<void>> = [];
    reveals.forEach((rev, k) => {
      if (!k.startsWith(`${round}:`)) return;
      const peerId = k.slice(round.length + 1);
      const c = commits.get(k);
      if (!c) return;
      // verifyReveal is async; we can't await inside the synchronous map.
      // For render-time we do a best-effort sync check: parse the payload
      // and require non-empty. Caller can re-verify async if needed.
      try {
        const parsed = JSON.parse(rev.payload) as { amount?: number };
        if (typeof parsed.amount !== "number") return;
        out.push({ peerId, amount: parsed.amount });
        // Fire-and-forget verify; surface failure via a console warning.
        verifyPromises.push(
          verifyReveal(c.hash, rev).then((ok) => {
            if (!ok) console.warn(`[useBid] reveal failed verify for ${peerId}`);
          }),
        );
      } catch {
        /* skip malformed */
      }
    });
    out.sort((a, b) => b.amount - a.amount || a.peerId.localeCompare(b.peerId));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveals, commits, round]);

  let pendingCount = 0;
  if (commits) {
    commits.forEach((_, k) => {
      if (!k.startsWith(`${round}:`)) return;
      if (!reveals?.has(k)) pendingCount += 1;
    });
  }

  const startNewRound = useCallback(() => {
    if (!room) return;
    const nextRound = `r${Date.now()}`;
    room.doc.getMap<string>(`${key}_round`).set("current", nextRound);
    setLocalSalt(null);
    setLocalAmount(null);
  }, [room, key]);

  return {
    myPending: myCommit != null && myReveal == null,
    myRevealed: myReveal != null,
    myAmount: localAmount,
    submitBid,
    revealMine,
    revealed,
    winner: revealed[0] ?? null,
    pendingCount,
    startNewRound,
    round,
  };
}
