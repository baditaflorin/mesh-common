import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type SharedReservation = { peerId: string; reservedAt: number; expiresAt: number };

/** Capacity gate with expiring reservations and deterministic peer-id waitlist ordering. */
export function useSharedReservation(room: YRoom | null, key: string, opts: { capacity: number; ttlMs?: number }) {
  const [, refresh] = useState(0);
  const capacity = Math.max(0, Math.floor(opts.capacity));
  const ttlMs = Math.max(1, opts.ttlMs ?? 60_000);
  useEffect(() => {
    if (!room) return;
    const map = room.doc.getMap<SharedReservation>(`reservation:${key}`);
    const cb = () => refresh((n) => n + 1);
    map.observe(cb);
    const timer = setInterval(cb, Math.min(ttlMs, 1000));
    return () => { map.unobserve(cb); clearInterval(timer); };
  }, [room, key, ttlMs]);
  const map = room?.doc.getMap<SharedReservation>(`reservation:${key}`) ?? null;
  const now = Date.now();
  const reservations = map ? [...map.values()].filter((r) => r.expiresAt > now).sort((a, b) => a.reservedAt - b.reservedAt || a.peerId.localeCompare(b.peerId)) : [];
  const mineIndex = room ? reservations.findIndex((r) => r.peerId === room.peerId) : -1;
  return {
    reservations,
    remaining: Math.max(0, capacity - reservations.length),
    admitted: mineIndex >= 0 && mineIndex < capacity,
    waitlisted: mineIndex >= capacity,
    position: mineIndex < 0 ? null : mineIndex + 1,
    reserve: () => { if (room && map) map.set(room.peerId, { peerId: room.peerId, reservedAt: Date.now(), expiresAt: Date.now() + ttlMs }); },
    release: () => { if (room && map?.get(room.peerId)?.peerId === room.peerId) map.delete(room.peerId); },
  };
}
