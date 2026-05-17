import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type Fix = {
  name: string;
  lat: number;
  lon: number;
  accuracy: number;
  ts: number;
};

export type SharedLocation = {
  /** All currently-shared fixes, keyed by peerId. */
  fixes: Record<string, Fix>;
  /** This peer's most recent fix, if sharing. */
  mine: Fix | null;
  /** True iff this peer is actively sharing. */
  isSharing: boolean;
  /** Flip sharing on/off. Side-effects: requests permission on enable, removes my fix on disable. */
  toggle: () => void;
  /** Permission / hardware error, if any. */
  error: string | null;
  /** Distance in meters between two fixes (haversine). Exposed so apps don't reimplement. */
  distanceM: (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => number;
};

const SHARE_KEY = (prefix: string) => `${prefix}:location:sharing`;

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Opt-in geolocation sharing. Wraps `navigator.geolocation.watchPosition`,
 * stores fixes in `Y.Map<peerId, Fix>`, and persists the "sharing on"
 * preference to localStorage. Powers find-my-family, route-share, geo-tag,
 * and anything else that wants a mesh of "where everyone is right now."
 *
 * Honest: all peers in the room see all fixes. There is no per-peer
 * encryption here. If you want fine-grained sharing, layer ECDH on top.
 */
export function useSharedLocation(
  room: YRoom | null,
  storagePrefix: string,
  opts?: { mapKey?: string },
): SharedLocation {
  const mapKey = opts?.mapKey ?? "__mesh_locations";
  const myName = ""; // app-supplied; left blank — apps usually pass name from useNamedPeer

  const [isSharing, setIsSharing] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(SHARE_KEY(storagePrefix)) === "1";
    } catch {
      return false;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [, rerender] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(SHARE_KEY(storagePrefix), isSharing ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [isSharing, storagePrefix]);

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<Fix>(mapKey);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, mapKey]);

  useEffect(() => {
    if (!room) return;
    const fixes = room.doc.getMap<Fix>(mapKey);
    if (!isSharing) {
      fixes.delete(room.peerId);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("geolocation not supported");
      setIsSharing(false);
      return;
    }
    setError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        fixes.set(room.peerId, {
          name: myName,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: Date.now(),
        });
      },
      (err) => {
        setError(err.message);
        setIsSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      fixes.delete(room.peerId);
    };
  }, [room, isSharing, mapKey]);

  const fixes: Record<string, Fix> = {};
  if (room) {
    room.doc.getMap<Fix>(mapKey).forEach((v, k) => {
      fixes[k] = v;
    });
  }
  const mine = room ? (fixes[room.peerId] ?? null) : null;

  return {
    fixes,
    mine,
    isSharing,
    toggle: () => setIsSharing((s) => !s),
    error,
    distanceM: haversine,
  };
}
