import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "../useYRoom";

export type ChallengeRecord = {
  id: string;
  from: string;
  to: string;
  ts: number;
  /** App-defined slug ("rps", "duel", "trivia") — useful for routing. */
  kind: string;
  /** "pending" until either accepted or declined. */
  status: "pending" | "accepted" | "declined" | "expired";
};

export type ChallengeState = {
  /** Outgoing pending challenges from this peer. */
  myPending: ChallengeRecord[];
  /** Incoming pending challenges to this peer. */
  incomingPending: ChallengeRecord[];
  /** All currently-accepted challenges this peer is part of. */
  myActive: ChallengeRecord[];
  /** Issue a new challenge. */
  challenge: (toPeerId: string, kind?: string) => string;
  /** Accept an incoming challenge by id. */
  accept: (id: string) => void;
  /** Decline an incoming challenge by id. */
  decline: (id: string) => void;
  /** Cancel an outgoing challenge by id. */
  cancel: (id: string) => void;
};

const ttlMs = 30_000;

function newId(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Peer-to-peer challenge handshake: A challenges B → B accepts or declines.
 * Auto-expires after 30s of no answer. Pair with `usePairing` for paired
 * games or `useDirectMessage` for content; this primitive owns just the
 * lifecycle.
 *
 *   const c = useChallenge(room, "rps-challenge");
 *   c.challenge(theirPeerId, "rps");
 *   c.incomingPending.map(...);
 */
export function useChallenge(room: YRoom | null, key: string): ChallengeState {
  const [, rerender] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<ChallengeRecord>(key);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room, key]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const map = room ? room.doc.getMap<ChallengeRecord>(key) : null;
  const myPeer = room?.peerId ?? "";

  const all: ChallengeRecord[] = [];
  if (map) {
    map.forEach((rec) => {
      const expired = rec.status === "pending" && now - rec.ts > ttlMs;
      all.push(expired ? { ...rec, status: "expired" } : rec);
    });
  }

  const myPending = all.filter((r) => r.from === myPeer && r.status === "pending");
  const incomingPending = all.filter((r) => r.to === myPeer && r.status === "pending");
  const myActive = all.filter(
    (r) => (r.from === myPeer || r.to === myPeer) && r.status === "accepted",
  );

  const challenge = useCallback(
    (toPeerId: string, kind = "default") => {
      if (!room || !map) return "";
      const rec: ChallengeRecord = {
        id: newId(),
        from: room.peerId,
        to: toPeerId,
        ts: Date.now(),
        kind,
        status: "pending",
      };
      map.set(rec.id, rec);
      return rec.id;
    },
    [room, map],
  );

  const update = useCallback(
    (id: string, status: ChallengeRecord["status"]) => {
      if (!map) return;
      const rec = map.get(id);
      if (!rec) return;
      map.set(id, { ...rec, status });
    },
    [map],
  );

  return {
    myPending,
    incomingPending,
    myActive,
    challenge,
    accept: (id) => update(id, "accepted"),
    decline: (id) => update(id, "declined"),
    cancel: (id) => update(id, "declined"),
  };
}
