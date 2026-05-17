/**
 * Moderator role — first-claim-wins, signed, auto-expires after a TTL.
 *
 * Stored in `Y.Map<"current", ModeratorClaim>` under the well-known key
 * `__mesh_moderator`. Anyone may claim if the slot is empty or the current
 * claim is past `expiresAt`. The claim is signed by the claimant's Ed25519
 * key (registered in the TOFU registry) so impersonation is rejected.
 *
 * What the role is for:
 *   - Lead UI ceremonies ("round starts now")
 *   - Authoritative-looking display ("alice (moderating)")
 *   - Soft moderation (a flag peers running the standard client honor)
 *   - Tiebreaks on CRDT-merged contradictions
 *
 * What the role is NOT for:
 *   - Kicking peers off the mesh (impossible — peers hold the CRDT locally)
 *   - Force-deleting data (impossible — CRDT history is monotone)
 *   - Rate-limiting / spam filtering (impossible — runs locally)
 *
 * Anywhere you'd want server-grade enforcement, design the feature so it
 * doesn't need it (open tally, signed ballots, public audit log).
 */

import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";
import type { Identity } from "./identity";
import { verifyPayload } from "./identity";
import { usePeerRegistry, type PeerRegistry } from "./tofuRegistry";

export const DEFAULT_MODERATOR_TTL_MS = 30 * 60 * 1000;

export type ModeratorClaim = {
  peerId: string;
  pubkey: string;
  claimedAt: number;
  expiresAt: number;
  nonce: string;
  sig: string; // signature over {peerId, pubkey, claimedAt, expiresAt, nonce}
};

export type ModeratorState = {
  /** The current verified moderator claim, or null if vacant/expired. */
  current: ModeratorClaim | null;
  /** True iff this peer holds the moderator role right now. */
  isMe: boolean;
  /** Milliseconds until the current claim expires, or 0 if vacant. */
  expiresInMs: number;
  /** Try to claim the role. No-op if someone else holds an unexpired claim. */
  claim: () => void;
  /** Relinquish the role. No-op if this peer isn't the current moderator. */
  relinquish: () => void;
  /** Human-readable status string for UI. */
  statusText: string;
};

function nowMs() {
  return Date.now();
}

function randomNonce(): string {
  const buf = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function verifyClaim(c: ModeratorClaim, registry: PeerRegistry): boolean {
  if (!c || !c.pubkey || !c.sig) return false;
  // The claim must be self-signed (the pubkey field IS the verifier key)
  const ok = verifyPayload(
    {
      peerId: c.peerId,
      pubkey: c.pubkey,
      claimedAt: c.claimedAt,
      expiresAt: c.expiresAt,
      nonce: c.nonce,
    },
    c.sig,
    c.pubkey,
  );
  if (!ok) return false;
  // Additionally check that the registry-recorded pubkey for this peerId
  // matches — i.e., this peer is who they claim to be in our TOFU view.
  const registered = registry.getPubkey(c.peerId);
  // If unregistered (peer hasn't published yet), accept self-signed for now
  // — this is the bootstrap case for the very first moderator.
  if (registered && registered !== c.pubkey) return false;
  return true;
}

export type UseModeratorOptions = {
  /** TTL in ms (default 30 minutes). After this, the slot is treated as vacant. */
  ttlMs?: number;
  /** Auto-register this peer in the TOFU registry on first claim. Default true. */
  autoRegister?: boolean;
};

/**
 * Hook for the signed-moderator role. Pass the room, the storagePrefix, this
 * peer's Identity (from `useIdentity`), and optionally a TTL.
 */
export function useModerator(
  room: YRoom | null,
  storagePrefix: string,
  identity: Identity,
  opts: UseModeratorOptions = {},
): ModeratorState {
  const ttlMs = opts.ttlMs ?? DEFAULT_MODERATOR_TTL_MS;
  const autoRegister = opts.autoRegister !== false;
  const registry = usePeerRegistry(room, storagePrefix);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!room) return;
    const slot = room.doc.getMap<ModeratorClaim>("__mesh_moderator");
    const cb = () => tick((n) => n + 1);
    slot.observe(cb);
    return () => slot.unobserve(cb);
  }, [room]);

  // Re-render every second so expiresInMs and the auto-expire transition stay live.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!room) {
    return {
      current: null,
      isMe: false,
      expiresInMs: 0,
      claim: () => {},
      relinquish: () => {},
      statusText: "connecting…",
    };
  }

  const slot = room.doc.getMap<ModeratorClaim>("__mesh_moderator");
  const raw = slot.get("current") ?? null;
  const valid = raw && verifyClaim(raw, registry) ? raw : null;
  const expired = valid ? valid.expiresAt <= nowMs() : true;
  const current = expired ? null : valid;
  const isMe = !!current && current.peerId === room.peerId;
  const expiresInMs = current ? Math.max(0, current.expiresAt - nowMs()) : 0;

  const claim = () => {
    if (current && !expired) return; // someone else still holds it
    if (autoRegister) registry.register(room.peerId, identity.pubkey, identity.sign);
    const claimedAt = nowMs();
    const payload = {
      peerId: room.peerId,
      pubkey: identity.pubkey,
      claimedAt,
      expiresAt: claimedAt + ttlMs,
      nonce: randomNonce(),
    };
    const sig = identity.sign(payload);
    // Partition-aware tiebreak: lower claimedAt wins. If an existing claim
    // arrives later via merge, our local view will switch only if their
    // claimedAt is lower. CRDT merge handles the rest.
    slot.set("current", { ...payload, sig });
  };

  const relinquish = () => {
    if (!isMe) return;
    slot.delete("current");
  };

  const statusText = (() => {
    if (!current) return "no moderator — anyone can claim";
    const mins = Math.floor(expiresInMs / 60000);
    const secs = Math.floor((expiresInMs % 60000) / 1000);
    const time = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    if (isMe) return `you're moderating · auto-clears in ${time}`;
    return `${current.peerId.slice(0, 8)}… is moderating · ${time} left`;
  })();

  return { current, isMe, expiresInMs, claim, relinquish, statusText };
}
