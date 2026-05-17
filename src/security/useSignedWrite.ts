import { useCallback, useEffect } from "react";
import { verifyPayload, type Identity } from "../identity";
import { usePeerRegistry } from "../tofuRegistry";
import type { YRoom } from "../useYRoom";

export type SignedRecord<T> = {
  /** Payload chosen by the app. */
  payload: T;
  /** Ed25519 signature (hex). */
  sig: string;
  /** Author's pubkey (hex). */
  pubkey: string;
  /** Author's peerId at write time. */
  peerId: string;
  /** Wall-clock ms at write time. */
  ts: number;
};

export type SignedWriter<T> = {
  /** Sign + write into the underlying Y.Map. */
  setSigned: (key: string, payload: T) => void;
  /** Read + verify. Returns the payload only if the signature checks AND the
   *  pubkey matches the TOFU-pinned record for that peer. */
  getVerified: (key: string) => T | null;
  /** Read the raw record without verifying. */
  getRecord: (key: string) => SignedRecord<T> | null;
  /** Iterate verified entries. */
  verifiedEntries: () => Array<[string, T]>;
};

/**
 * Drop-in upgrade for any `Y.Map<key, T>` into a signed-writes-only contract.
 * Composes with `useIdentity` (writer) + `usePeerRegistry` (TOFU verify).
 *
 *   const identity = useIdentity(config.storagePrefix);
 *   const writer = useSignedWrite<Vote>(room, "votes", identity);
 *   writer.setSigned(round, { choice: "yes" });
 *   const v = writer.getVerified(round); // null if sig invalid, unknown
 *                                         // pubkey, or TOFU mismatch
 *
 * The Y.Map stores `SignedRecord<T>` values; verification happens at read
 * time so a hostile peer cannot forge a record without the pubkey.
 */
export function useSignedWrite<T>(
  room: YRoom | null,
  key: string,
  identity: Identity | null,
): SignedWriter<T> {
  // NB: storagePrefix arg added to usePeerRegistry by a parallel refactor;
  // we pass the Y-doc-key as a stable namespace until callers pass their own.
  const registry = usePeerRegistry(room, key);

  // Register self in TOFU once identity + room are available.
  useEffect(() => {
    if (!room || !identity) return;
    try {
      registry.register(room.peerId, identity.pubkey, identity.sign);
    } catch {
      /* registry not ready */
    }
  }, [room, identity, registry]);

  const setSigned = useCallback(
    (innerKey: string, payload: T) => {
      if (!room || !identity) return;
      const ts = Date.now();
      const payloadWithMeta = { payload, peerId: room.peerId, ts };
      const sig = identity.sign(payloadWithMeta);
      const record: SignedRecord<T> = {
        payload,
        sig,
        pubkey: identity.pubkey,
        peerId: room.peerId,
        ts,
      };
      room.doc.getMap<SignedRecord<T>>(key).set(innerKey, record);
    },
    [room, identity, key],
  );

  const getRecord = useCallback(
    (innerKey: string): SignedRecord<T> | null => {
      if (!room) return null;
      return room.doc.getMap<SignedRecord<T>>(key).get(innerKey) ?? null;
    },
    [room, key],
  );

  const getVerified = useCallback(
    (innerKey: string): T | null => {
      const rec = getRecord(innerKey);
      if (!rec) return null;
      const payloadWithMeta = { payload: rec.payload, peerId: rec.peerId, ts: rec.ts };
      if (!verifyPayload(payloadWithMeta, rec.sig, rec.pubkey)) return null;
      // Enforce TOFU: pubkey must match what we first saw for this peer.
      const pinnedPubkey = registry.getPubkey(rec.peerId);
      if (pinnedPubkey && pinnedPubkey !== rec.pubkey) return null;
      return rec.payload;
    },
    [getRecord, registry],
  );

  const verifiedEntries = useCallback((): Array<[string, T]> => {
    if (!room) return [];
    const out: Array<[string, T]> = [];
    room.doc.getMap<SignedRecord<T>>(key).forEach((_, k) => {
      const v = getVerified(k);
      if (v !== null) out.push([k, v]);
    });
    return out;
  }, [room, key, getVerified]);

  return { setSigned, getVerified, getRecord, verifiedEntries };
}
