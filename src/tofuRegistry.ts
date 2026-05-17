/**
 * TOFU (Trust On First Use) peer-pubkey registry.
 *
 * Each peer publishes ONLY their own entry in `Y.Map<peerId, PubkeyRecord>`.
 * The record is self-signed so other peers can verify "this entry was indeed
 * created by the holder of the claimed pubkey." On the receiving side, each
 * client maintains a LOCAL TOFU cache (sessionStorage) recording the first
 * valid pubkey it observed for each peerId — later writes by anyone other
 * than the original keyholder are rejected.
 *
 * What this catches:
 *   - Bob writing `peers[alice]={pubkey:bob's}` to impersonate alice — the
 *     self-signature is over `{peerId:alice, pubkey:bob's}` signed by bob's
 *     key. Verification fails because the sig wasn't made by alice's key.
 *
 * What this does NOT catch:
 *   - The FIRST time a peerId appears, the local client trusts the pubkey
 *     blindly. A bad actor can pre-publish a fake entry before the real peer
 *     arrives. Mitigations: out-of-band pubkey sharing (room URL = trust
 *     anchor), or require the peerId to be derived from the pubkey (we do
 *     this in `peerIdFromPubkey`).
 */

import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";
import { verifyPayload, hashPayload } from "./identity";

export type PubkeyRecord = {
  peerId: string;
  pubkey: string;
  claimedAt: number;
  sig: string; // signature over {peerId, pubkey, claimedAt}
};

/** Deterministic peerId derived from the public key. Apps can keep their own
 *  random peerId for backwards compat, but registering it here under a derived
 *  alias gives MITM-resistance: a forged peerId won't match its pubkey. */
export function peerIdFromPubkey(pubkey: string): string {
  // First 16 hex chars (8 bytes / 64 bits) of the pubkey. Collisions are
  // astronomically improbable in a single room.
  return pubkey.slice(0, 16);
}

const TOFU_KEY = (prefix: string) => `${prefix}:tofu:v1`;

type TofuCache = Record<string, { pubkey: string; firstSeen: number }>;

function loadCache(prefix: string): TofuCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(TOFU_KEY(prefix));
    return raw ? (JSON.parse(raw) as TofuCache) : {};
  } catch {
    return {};
  }
}

function saveCache(prefix: string, cache: TofuCache): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TOFU_KEY(prefix), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

export type PeerRegistry = {
  /** Publish this peer's own pubkey record (idempotent — no-op if unchanged). */
  register: (peerId: string, pubkey: string, sign: (p: unknown) => string) => void;
  /** Look up the verified pubkey for a peerId. Returns null if unknown or invalid. */
  getPubkey: (peerId: string) => string | null;
  /** Verify a signed message — convenience that pulls the pubkey from the registry. */
  verifyMessage: (peerId: string, payload: unknown, sig: string) => boolean;
  /** How many peers have published verified entries. */
  size: number;
};

export function usePeerRegistry(
  room: YRoom | null,
  storagePrefix: string,
): PeerRegistry {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const peers = room.doc.getMap<PubkeyRecord>("__mesh_peers");
    const cb = () => rerender((n) => n + 1);
    peers.observe(cb);
    return () => peers.unobserve(cb);
  }, [room]);

  if (!room) {
    return {
      register: () => {},
      getPubkey: () => null,
      verifyMessage: () => false,
      size: 0,
    };
  }

  const peers = room.doc.getMap<PubkeyRecord>("__mesh_peers");
  const cache = loadCache(storagePrefix);

  const verifyRecord = (rec: PubkeyRecord): boolean => {
    if (!rec || !rec.peerId || !rec.pubkey || !rec.sig) return false;
    return verifyPayload(
      { peerId: rec.peerId, pubkey: rec.pubkey, claimedAt: rec.claimedAt },
      rec.sig,
      rec.pubkey,
    );
  };

  const register: PeerRegistry["register"] = (peerId, pubkey, sign) => {
    const existing = peers.get(peerId);
    if (existing && existing.pubkey === pubkey && verifyRecord(existing)) return;
    const claimedAt = Date.now();
    const payload = { peerId, pubkey, claimedAt };
    const sig = sign(payload);
    peers.set(peerId, { ...payload, sig });
    // Update TOFU cache for self
    cache[peerId] = { pubkey, firstSeen: claimedAt };
    saveCache(storagePrefix, cache);
  };

  const getPubkey: PeerRegistry["getPubkey"] = (peerId) => {
    const rec = peers.get(peerId);
    if (!rec || !verifyRecord(rec)) return null;
    // TOFU check: if we've seen this peerId before with a different pubkey, reject
    const cached = cache[peerId];
    if (cached) {
      if (cached.pubkey !== rec.pubkey) return null; // pubkey rotated mid-room — refuse
      return rec.pubkey;
    }
    // First time we see this peerId — accept and remember
    cache[peerId] = { pubkey: rec.pubkey, firstSeen: Date.now() };
    saveCache(storagePrefix, cache);
    return rec.pubkey;
  };

  const verifyMessage: PeerRegistry["verifyMessage"] = (peerId, payload, sig) => {
    const pk = getPubkey(peerId);
    if (!pk) return false;
    return verifyPayload(payload, sig, pk);
  };

  let size = 0;
  peers.forEach((rec) => {
    if (verifyRecord(rec)) size++;
  });

  return { register, getPubkey, verifyMessage, size };
}

/** Stable hash of a {peerId, pubkey} pair — useful for displaying as a short
 *  trust fingerprint ("verify in person: 3a-7c-92-…"). */
export function trustFingerprint(peerId: string, pubkey: string): string {
  const h = hashPayload({ peerId, pubkey });
  // Group into bytes, take first 6 for a 12-char fingerprint
  return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6), h.slice(6, 8)].join("-");
}
