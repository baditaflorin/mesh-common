import { useCallback, useEffect, useRef } from "react";
import { verifyPayload, type Identity } from "../identity";
import { usePeerRegistry } from "../tofuRegistry";
import type { YRoom } from "../useYRoom";

/** Domain tag mixed into every signature so it cannot verify in another context. */
const SIGNED_WRITE_DOMAIN = "mesh-common/signed-write/v2";

/**
 * What actually gets signed. Binding the room, map and entry key means a
 * valid record copied to another key, map or room no longer verifies.
 */
function signedEnvelope<T>(
  roomId: string,
  map: string,
  innerKey: string,
  rec: { payload: T; peerId: string; ts: number },
) {
  return {
    domain: SIGNED_WRITE_DOMAIN,
    room: roomId,
    map,
    key: innerKey,
    payload: rec.payload,
    peerId: rec.peerId,
    ts: rec.ts,
  };
}

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
 *
 * Verification fails closed: a record only verifies when the author has a
 * registry entry whose pinned pubkey matches the record's, and the signature
 * covers this room, map and entry key. Records signed by mesh-common before
 * this envelope existed no longer verify.
 */
export function useSignedWrite<T>(
  room: YRoom | null,
  key: string,
  identity: Identity | null,
): SignedWriter<T> {
  // NB: storagePrefix arg added to usePeerRegistry by a parallel refactor;
  // we pass the Y-doc-key as a stable namespace until callers pass their own.
  const registry = usePeerRegistry(room, key);
  // The registry object is rebuilt every render; keep setSigned stable.
  const registryRef = useRef(registry);
  registryRef.current = registry;

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
      const sig = identity.sign(
        signedEnvelope(room.roomId, key, innerKey, { payload, peerId: room.peerId, ts }),
      );
      const record: SignedRecord<T> = {
        payload,
        sig,
        pubkey: identity.pubkey,
        peerId: room.peerId,
        ts,
      };
      // Readers reject records from unregistered authors, so publish our
      // registry entry in the same update as the record.
      room.doc.transact(() => {
        try {
          registryRef.current.register(room.peerId, identity.pubkey, identity.sign);
        } catch {
          /* registry not ready */
        }
        room.doc.getMap<SignedRecord<T>>(key).set(innerKey, record);
      });
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
      if (!room) return null;
      const rec = getRecord(innerKey);
      if (!rec) return null;
      const envelope = signedEnvelope(room.roomId, key, innerKey, rec);
      if (!verifyPayload(envelope, rec.sig, rec.pubkey)) return null;
      // Enforce TOFU, failing closed: the author must have a registry entry
      // and its pinned pubkey must be the one that signed this record. A
      // null lookup means unknown or mismatched, and both are rejected.
      const pinnedPubkey = registry.getPubkey(rec.peerId);
      if (pinnedPubkey === null || pinnedPubkey !== rec.pubkey) return null;
      return rec.payload;
    },
    [room, key, getRecord, registry],
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
