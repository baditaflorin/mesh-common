import type { YRoom } from "./useYRoom";
import { useSharedReservation } from "./useSharedReservation";

export type RoomCapacityMember = {
  peerId: string;
  joinedAt: number;
  expiresAt: number;
};

export type RoomCapacityOptions = {
  /** Maximum admitted peers. Values below zero are treated as zero. */
  capacity: number;
  /** Lease duration before a disconnected participant can be replaced. Default: 60 seconds. */
  ttlMs?: number;
};

export type RoomCapacity = {
  /** Active lease holders, ordered deterministically by join time then peer id. */
  members: RoomCapacityMember[];
  capacity: number;
  remaining: number;
  admitted: boolean;
  waitlisted: boolean;
  /** One-based position in the deterministic admission order, or null before joining. */
  position: number | null;
  /** Create or renew this peer's lease. */
  join: () => void;
  /** Release this peer's lease. */
  leave: () => void;
};

/**
 * A room-oriented vocabulary over `useSharedReservation` for admission gates.
 *
 * The underlying CRDT keeps an expiring lease for every interested peer and
 * sorts by `(reservedAt, peerId)`, giving all peers the same admitted first N
 * members without a server. Call `join()` from an intentional user action and
 * call it again to renew a long-lived room; call `leave()` on an explicit exit.
 */
export function useRoomCapacity(
  room: YRoom | null,
  key: string,
  options: RoomCapacityOptions,
): RoomCapacity {
  const capacity = Math.max(0, Math.floor(options.capacity));
  const reservation = useSharedReservation(room, `capacity:${key}`, {
    capacity,
    ttlMs: options.ttlMs,
  });
  return {
    members: reservation.reservations.map((entry) => ({
      peerId: entry.peerId,
      joinedAt: entry.reservedAt,
      expiresAt: entry.expiresAt,
    })),
    capacity,
    remaining: reservation.remaining,
    admitted: reservation.admitted,
    waitlisted: reservation.waitlisted,
    position: reservation.position,
    join: reservation.reserve,
    leave: reservation.release,
  };
}
