import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";
import { commit as makeCommit, verifyReveal, randomSalt } from "./commitReveal";

export type CommitRevealStatus = "idle" | "committed" | "revealed";

export type CommitRevealEntry<T> = {
  peerId: string;
  hash?: string;
  reveal?: { salt: string; payload: T };
  /** Did we lock in a payload locally even before the network confirmed? */
  pending?: boolean;
};

export type CommitRevealState<T> = {
  /** Commit a payload. Salt is generated + persisted locally; only the hash is published. */
  commit: (payload: T) => Promise<void>;
  /** Reveal this peer's previously-committed payload. */
  reveal: () => Promise<void>;
  /** This peer's commit hash (if any). */
  myHash: string | null;
  /** This peer's revealed payload (if reveal() succeeded). */
  myReveal: T | null;
  /** Per-peer entries — both phases visible. */
  entries: Record<string, CommitRevealEntry<T>>;
  /** This peer's lifecycle status. */
  status: CommitRevealStatus;
  /** Has this peer's revealed payload been verified against its commit hash? */
  verified: boolean;
};

const SECRET_KEY = (prefix: string, key: string, peerId: string) =>
  `${prefix}:cr-secret:${key}:${peerId}`;

type Stored<T> = { salt: string; payload: T };

/**
 * Generic commit-reveal flow. Each peer commits a hash, stores the salt+payload
 * privately in localStorage, then later reveals. Other peers verify the reveal
 * matches the original commit. Powers fair RNG, sealed votes, sealed roles,
 * pictionary's "drawer pre-commits to a word" check.
 *
 * Per-peer storage is keyed by peerId so two pages in the same browser
 * context (the Playwright testing pattern) keep their secrets separate.
 */
export function useCommitRevealHook<T>(
  room: YRoom | null,
  storagePrefix: string,
  key: string,
): CommitRevealState<T> {
  const [, rerender] = useState(0);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!room) return;
    const commits = room.doc.getMap<string>(`${key}:commits`);
    const reveals = room.doc.getMap<{ salt: string; payload: T }>(`${key}:reveals`);
    const cb = () => rerender((n) => n + 1);
    commits.observe(cb);
    reveals.observe(cb);
    return () => {
      commits.unobserve(cb);
      reveals.unobserve(cb);
    };
  }, [room, key]);

  // Verify our own reveal once both sides land
  useEffect(() => {
    if (!room) return;
    const myHash = room.doc.getMap<string>(`${key}:commits`).get(room.peerId);
    const myReveal = room.doc
      .getMap<{ salt: string; payload: T }>(`${key}:reveals`)
      .get(room.peerId);
    if (!myHash || !myReveal) {
      setVerified(false);
      return;
    }
    void verifyReveal(myHash, {
      salt: myReveal.salt,
      payload: JSON.stringify(myReveal.payload),
    }).then(setVerified);
  });

  const commits = room?.doc.getMap<string>(`${key}:commits`);
  const reveals = room?.doc.getMap<{ salt: string; payload: T }>(`${key}:reveals`);
  const myHash = (room && commits?.get(room.peerId)) ?? null;
  const myReveal = (room && reveals?.get(room.peerId)?.payload) ?? null;
  const status: CommitRevealStatus = myReveal ? "revealed" : myHash ? "committed" : "idle";

  const entries: Record<string, CommitRevealEntry<T>> = {};
  if (commits) {
    commits.forEach((hash, peerId) => {
      entries[peerId] = { peerId, hash };
    });
  }
  if (reveals) {
    reveals.forEach((r, peerId) => {
      entries[peerId] = { ...(entries[peerId] ?? { peerId }), reveal: r };
    });
  }

  return {
    myHash,
    myReveal,
    entries,
    status,
    verified,
    commit: async (payload) => {
      if (!room || !commits) return;
      const salt = randomSalt();
      const c = await makeCommit(JSON.stringify(payload), salt);
      try {
        localStorage.setItem(
          SECRET_KEY(storagePrefix, key, room.peerId),
          JSON.stringify({ salt, payload } as Stored<T>),
        );
      } catch {
        /* private mode etc */
      }
      commits.set(room.peerId, c.hash);
    },
    reveal: async () => {
      if (!room || !reveals) return;
      let stored: Stored<T> | null = null;
      try {
        const raw = localStorage.getItem(SECRET_KEY(storagePrefix, key, room.peerId));
        if (raw) stored = JSON.parse(raw) as Stored<T>;
      } catch {
        /* ignore */
      }
      if (!stored) return;
      reveals.set(room.peerId, stored);
    },
  };
}
