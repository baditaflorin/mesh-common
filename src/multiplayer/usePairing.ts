import { useMemo } from "react";
import { useRoster } from "../useRoster";
import { useFairRng } from "../useFairRng";
import { useMeshSlot } from "../useMeshSlot";
import type { ClockSync } from "../clockSync";
import type { YRoom } from "../useYRoom";

export type Pairing = {
  /** peerId this peer is paired with (null if odd-one-out or alone). */
  myPartnerId: string | null;
  /** All pairings in the current round: `[[a, b], [c, d], ...]`. Odd peer is appended alone as `[id]`. */
  pairings: Array<[string] | [string, string]>;
  /** Current round number (advances every `roundMs`). */
  round: number;
  /** ms until the next round / re-pair. */
  msToNextRound: number;
  /** Force a re-pair immediately (re-seeds RNG). */
  shuffle: () => void;
};

/**
 * Deterministic auto-pairing for 1v1 rounds. Each round, peers are shuffled
 * via `useFairRng` (commit-reveal randomness no peer can game) and paired
 * up. Powers rps-arena, blind-date, two-truths-one-lie.
 *
 *   const p = usePairing(room, clock, { roundMs: 60_000 });
 *   p.myPartnerId && <Duel partner={p.myPartnerId}/>
 */
export function usePairing(
  room: YRoom | null,
  clock: ClockSync | null,
  opts: { roundMs: number },
): Pairing {
  const roster = useRoster(room);
  const fair = useFairRng(room, "pairing", { minContributors: 1 });
  const slot = useMeshSlot(clock, opts.roundMs);

  const pairings = useMemo<Array<[string] | [string, string]>>(() => {
    if (roster.present.length === 0) return [];
    const ordered = fair.seed != null ? fair.shuffle(roster.present) : [...roster.present];
    const out: Array<[string] | [string, string]> = [];
    for (let i = 0; i < ordered.length; i += 2) {
      if (i + 1 < ordered.length) out.push([ordered[i]!, ordered[i + 1]!]);
      else out.push([ordered[i]!]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.present.join("|"), fair.seed, slot.slotId]);

  const myPartnerId = useMemo(() => {
    if (!room) return null;
    for (const pair of pairings) {
      if (pair.length === 2) {
        if (pair[0] === room.peerId) return pair[1] ?? null;
        if (pair[1] === room.peerId) return pair[0] ?? null;
      }
    }
    return null;
  }, [pairings, room]);

  return {
    myPartnerId,
    pairings,
    round: slot.slotId,
    msToNextRound: slot.slotMsRemaining,
    shuffle: () => fair.rerollMine(),
  };
}
