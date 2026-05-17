import { useMeshSlot } from "./useMeshSlot";
import { useRoster } from "./useRoster";
import type { ClockSync } from "./clockSync";
import type { YRoom } from "./useYRoom";

export type RotatingTurn = {
  /** peerId whose turn is currently active (null when roster is empty). */
  currentPeerId: string | null;
  /** peerId whose turn comes next. */
  nextPeerId: string | null;
  /** True iff `currentPeerId === room.peerId`. */
  isMyTurn: boolean;
  /** ms until the current turn ends. */
  msToNextTurn: number;
  /** Slot ordinal — same identity as `useMeshSlot.slotId`. */
  slotId: number;
  /** 0..1 fraction of the current turn elapsed. */
  progress: number;
  /** Current order — useful for "next up" lists. */
  order: string[];
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function shuffleByEpoch<T>(items: T[], epoch: number): T[] {
  // Deterministic Fisher-Yates seeded by the epoch + a position hash.
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = hashString(`${epoch}:${i}`) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Whose-turn-is-it derived from `useMeshSlot` + `useRoster`. Replaces ~40
 * lines of "compute slot, list roster, hash to index" glue in storyworm,
 * spotlight, conversation-cards, debate-clock, etc.
 *
 *   const { currentPeerId, isMyTurn, msToNextTurn } =
 *     useRotatingTurn(room, clock, { slotMs: 30_000, order: "shuffle" });
 *
 * `order: "shuffle"` reseeds the rotation every `reshuffleEvery` slots
 * (default: every slot) so it doesn't always go alice → bob → alice → bob.
 * `order: "stable"` rotates in sorted peerId order.
 */
export function useRotatingTurn(
  room: YRoom | null,
  clock: ClockSync | null,
  opts: {
    slotMs: number;
    order?: "stable" | "shuffle";
    reshuffleEvery?: number;
  },
): RotatingTurn {
  const slot = useMeshSlot(clock, opts.slotMs);
  const roster = useRoster(room);
  const order = opts.order ?? "stable";
  const reshuffleEvery = opts.reshuffleEvery ?? 1;

  if (roster.present.length === 0 || !room) {
    return {
      currentPeerId: null,
      nextPeerId: null,
      isMyTurn: false,
      msToNextTurn: slot.slotMsRemaining,
      slotId: slot.slotId,
      progress: slot.progress,
      order: [],
    };
  }

  const epoch = Math.floor(slot.slotId / reshuffleEvery);
  const rotated = order === "shuffle" ? shuffleByEpoch(roster.present, epoch) : roster.present;
  const idx = ((slot.slotId % rotated.length) + rotated.length) % rotated.length;
  const currentPeerId = rotated[idx] ?? null;
  const nextPeerId = rotated[(idx + 1) % rotated.length] ?? null;

  return {
    currentPeerId,
    nextPeerId,
    isMyTurn: currentPeerId === room.peerId,
    msToNextTurn: slot.slotMsRemaining,
    slotId: slot.slotId,
    progress: slot.progress,
    order: rotated,
  };
}
