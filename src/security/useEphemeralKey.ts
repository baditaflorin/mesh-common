import { useMemo } from "react";
import { x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/webcrypto.js";

/**
 * Per-session ephemeral X25519 keypair for sealed-box DMs between two peers.
 *
 * Unlike `useIdentity` (long-lived Ed25519, signs claims), this generates a
 * *fresh* X25519 keypair on every page load. Sender uses recipient's
 * ephemeral pubkey + sender's ephemeral seckey to derive a shared secret
 * (ECDH), then AES-GCM-encrypts the payload.
 *
 * Use for anonymous compliments, blind votes, sealed bids — anywhere
 * "this peer sent this, but no one else can read it" is the goal.
 *
 *   const k = useEphemeralKey();
 *   // publish my pubkey somewhere (e.g. usePerPeerValue)
 *   // to encrypt to peer X who has pubkey pubX:
 *   const ct = k.seal(pubX, JSON.stringify({ msg: "secret" }));
 *   // on the other side:
 *   const plain = k.open(senderPubkey, ct);
 *
 * Honest scope: this only protects message *contents*. Metadata (who sent
 * to whom, when, payload length) is still visible to all peers in the room.
 * The keypair is lost on reload — design accordingly.
 */
function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(h: string): Uint8Array {
  const o = new Uint8Array(h.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return o;
}

export type EphemeralKey = {
  /** Public key (hex). Publish this so others can encrypt to you. */
  pubkey: string;
  /**
   * Encrypt a plaintext to another peer's ephemeral pubkey.
   * Returns hex: `nonce(24) || ciphertext`.
   */
  seal: (recipientPubHex: string, plaintext: string | Uint8Array) => string;
  /**
   * Decrypt a sealed-box from a specific sender's pubkey.
   * Returns the plaintext as Uint8Array, or null if decryption failed.
   */
  open: (senderPubHex: string, sealedHex: string) => Uint8Array | null;
  /** Convenience: open + UTF-8 decode. */
  openText: (senderPubHex: string, sealedHex: string) => string | null;
};

export function useEphemeralKey(): EphemeralKey {
  return useMemo<EphemeralKey>(() => {
    const sec = randomBytes(32);
    const pub = x25519.getPublicKey(sec);
    const pubHex = toHex(pub);

    const derive = (theirPubHex: string): Uint8Array => {
      const shared = x25519.getSharedSecret(sec, fromHex(theirPubHex));
      return sha256(shared);
    };

    const seal: EphemeralKey["seal"] = (recipientPubHex, plaintext) => {
      const key = derive(recipientPubHex);
      const nonce = randomBytes(24);
      const aead = gcm(key, nonce.slice(0, 12)); // AES-GCM uses 96-bit nonce
      const ptBytes = typeof plaintext === "string" ? new TextEncoder().encode(plaintext) : plaintext;
      const ct = aead.encrypt(ptBytes);
      const out = new Uint8Array(nonce.length + ct.length);
      out.set(nonce, 0);
      out.set(ct, nonce.length);
      return toHex(out);
    };

    const open: EphemeralKey["open"] = (senderPubHex, sealedHex) => {
      try {
        const bytes = fromHex(sealedHex);
        const nonce = bytes.slice(0, 24);
        const ct = bytes.slice(24);
        const key = derive(senderPubHex);
        const aead = gcm(key, nonce.slice(0, 12));
        return aead.decrypt(ct);
      } catch {
        return null;
      }
    };

    const openText: EphemeralKey["openText"] = (senderPubHex, sealedHex) => {
      const bytes = open(senderPubHex, sealedHex);
      if (!bytes) return null;
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return null;
      }
    };

    return { pubkey: pubHex, seal, open, openText };
  }, []);
}
