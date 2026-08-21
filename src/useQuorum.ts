import { useRoster } from "./useRoster";
import type { YRoom } from "./useYRoom";

export type QuorumState = {
  required: number;
  present: string[];
  missing: number;
  satisfied: boolean;
};

/** Derive a stale-tolerant participant quorum from the shared roster. */
export function useQuorum(room: YRoom | null, required: number): QuorumState {
  const roster = useRoster(room);
  const safeRequired = Math.max(0, Math.floor(required));
  return {
    required: safeRequired,
    present: roster.present,
    missing: Math.max(0, safeRequired - roster.present.length),
    satisfied: roster.present.length >= safeRequired,
  };
}
