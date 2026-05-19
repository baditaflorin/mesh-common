import { useEffect, useMemo, useState } from "react";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/webcrypto.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";

/**
 * Room-wide E2E encryption: every peer in the room derives the same AES-256
 * key from a shared passphrase + room-scoped salt, then envelopes individual
 * Yjs writes with AES-GCM.
 *
 * Use when "anyone with the room URL can read everything" is wrong — e.g.
 * a vote room that should be sealed until reveal, a journal-club where the
 * link will get forwarded but only the people you texted the passphrase to
 * should see the contents.
 *
 * Key derivation: PBKDF2-SHA256 with 200k iterations + the room ID as salt.
 * Slow on purpose (~150ms on a mid-range phone) — this is how we make
 * weak passphrases more expensive to attack.
 *
 *   const seal = useRoomSeal({ roomId, passphrase });
 *   if (!seal.ready) return <p>deriving key…</p>;
 *   y.set("ballot", seal.encrypt(JSON.stringify({ vote: "yes" })));
 *   const plain = seal.decrypt(y.get("ballot"));
 *
 * Honest framing:
 *   - Metadata is NOT sealed (write timing, peerId-of-writer, size).
 *   - This is symmetric — every holder of the passphrase can write convincing
 *     "from another peer" ciphertext. Pair with `useSignedWrite` if integrity
 *     of provenance matters.
 *   - The passphrase MUST come from outside the room URL. Putting it in the
 *     room hash defeats the entire point.
 */

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(h: string): Uint8Array {
  const o = new Uint8Array(h.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return o;
}

export type RoomSealOptions = {
  roomId: string;
  passphrase: string;
  /** PBKDF2 iterations. Default 200_000. Lower in tests for speed. */
  iterations?: number;
};

export type RoomSeal = {
  ready: boolean;
  /** Encrypt a string or bytes; returns hex `nonce(12) || ciphertext`. */
  encrypt: (plain: string | Uint8Array) => string;
  /** Decrypt hex `nonce(12) || ciphertext`; returns Uint8Array or null. */
  decrypt: (sealedHex: string) => Uint8Array | null;
  /** Convenience: decrypt + UTF-8 decode. */
  decryptText: (sealedHex: string) => string | null;
  /** Short fingerprint of the derived key (8 hex). Display to peers so they
   *  can spot-check that they all derived the same key. */
  fingerprint: string;
};

/** Pure-function variant (no React). */
export function deriveRoomKey(roomId: string, passphrase: string, iterations = 200_000): Uint8Array {
  if (!roomId || !passphrase) throw new Error("roomId and passphrase are required");
  const salt = sha256(enc.encode(`mesh-common:roomSeal:v1:${roomId}`));
  return pbkdf2(sha256, enc.encode(passphrase), salt, { c: iterations, dkLen: 32 });
}

/** Build a sealing primitive from a 32-byte key. */
export function sealerFromKey(key: Uint8Array): Omit<RoomSeal, "ready"> {
  if (key.length !== 32) throw new Error("key must be 32 bytes");
  const fingerprint = toHex(sha256(key)).slice(0, 8);
  return {
    encrypt: (plain) => {
      const nonce = randomBytes(12);
      const aead = gcm(key, nonce);
      const pt = typeof plain === "string" ? enc.encode(plain) : plain;
      const ct = aead.encrypt(pt);
      const out = new Uint8Array(nonce.length + ct.length);
      out.set(nonce, 0);
      out.set(ct, nonce.length);
      return toHex(out);
    },
    decrypt: (sealedHex) => {
      try {
        const bytes = fromHex(sealedHex);
        if (bytes.length < 13) return null;
        const nonce = bytes.slice(0, 12);
        const ct = bytes.slice(12);
        const aead = gcm(key, nonce);
        return aead.decrypt(ct);
      } catch {
        return null;
      }
    },
    decryptText: function (sealedHex: string): string | null {
      const bytes = this.decrypt(sealedHex);
      if (!bytes) return null;
      try {
        return dec.decode(bytes);
      } catch {
        return null;
      }
    },
    fingerprint,
  };
}

/** React hook: derive the key asynchronously off the main thread when possible. */
export function useRoomSeal(opts: RoomSealOptions | null): RoomSeal {
  const [key, setKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    setKey(null);
    if (!opts) return;
    let cancelled = false;
    // Schedule onto a microtask so the UI gets to paint "deriving…" before
    // PBKDF2 lands. We don't use a worker here to keep the bundle small;
    // PBKDF2 at 200k iterations is ~150ms, acceptable for a one-time cost.
    queueMicrotask(() => {
      try {
        const k = deriveRoomKey(opts.roomId, opts.passphrase, opts.iterations);
        if (!cancelled) setKey(k);
      } catch {
        if (!cancelled) setKey(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [opts?.roomId, opts?.passphrase, opts?.iterations]);

  return useMemo<RoomSeal>(() => {
    if (!key) {
      return {
        ready: false,
        encrypt: () => "",
        decrypt: () => null,
        decryptText: () => null,
        fingerprint: "",
      };
    }
    const s = sealerFromKey(key);
    return { ready: true, ...s };
  }, [key]);
}
