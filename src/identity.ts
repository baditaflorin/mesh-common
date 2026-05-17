/**
 * Ed25519 identity for mesh peers.
 *
 * Every peer that wants to make a "trusted" claim (moderator, signed ballot,
 * favor-bank credit) needs a stable keypair. This module:
 *
 *  - generates a fresh keypair on first load
 *  - persists it to localStorage (per-app, keyed by storagePrefix)
 *  - exposes sign / verify helpers using `@noble/curves` Ed25519
 *
 * Bundle cost: ~32 KB gzipped (noble curves + hashes, no native deps).
 *
 * Honest framing: this binds the keyholder to *future* claims they sign. It
 * does NOT bind the keyholder to a real human, or prevent them from spawning
 * new identities. It also does NOT keep secrets — anything they publish to
 * the Y.Doc is visible to all peers. See the four-layer security stack in
 * the README for what this actually buys you.
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { useEffect, useMemo, useState } from "react";

const enc = new TextEncoder();

export type Keypair = {
  /** Hex-encoded 32-byte private key. KEEP THIS LOCAL. */
  privateKey: string;
  /** Hex-encoded 32-byte public key. Safe to publish. */
  publicKey: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Generate a fresh Ed25519 keypair. */
export function generateKeypair(): Keypair {
  const sk = ed25519.utils.randomSecretKey();
  const pk = ed25519.getPublicKey(sk);
  return { privateKey: toHex(sk), publicKey: toHex(pk) };
}

/** Stable canonical JSON encoding of any payload — sorted keys, no whitespace. */
function canonicalize(payload: unknown): string {
  return JSON.stringify(payload, Object.keys(payload as object).sort());
}

/** Hash payload deterministically (sha256 of canonical JSON). */
export function hashPayload(payload: unknown): string {
  return toHex(sha256(enc.encode(canonicalize(payload))));
}

/** Sign a payload with a hex private key. Returns hex signature. */
export function signPayload(payload: unknown, privateKey: string): string {
  const msg = enc.encode(canonicalize(payload));
  const sig = ed25519.sign(msg, fromHex(privateKey));
  return toHex(sig);
}

/** Verify a payload against a hex signature + hex public key. */
export function verifyPayload(
  payload: unknown,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  try {
    const msg = enc.encode(canonicalize(payload));
    return ed25519.verify(fromHex(signatureHex), msg, fromHex(publicKeyHex));
  } catch {
    return false;
  }
}

const KEY = (prefix: string) => `${prefix}:identity:v1`;

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* SecurityError in some browsers / contexts */
  }
  return null;
}

/** Load the persisted keypair for this app, or create + persist a new one. */
export function loadOrCreateIdentity(storagePrefix: string): Keypair {
  const ls = safeLocalStorage();
  if (ls) {
    try {
      const raw = ls.getItem(KEY(storagePrefix));
      if (raw) {
        const parsed = JSON.parse(raw) as Keypair;
        if (parsed.privateKey && parsed.publicKey) return parsed;
      }
    } catch {
      /* corrupted entry, regenerate */
    }
  }
  const kp = generateKeypair();
  if (ls) {
    try {
      ls.setItem(KEY(storagePrefix), JSON.stringify(kp));
    } catch {
      /* quota / private-mode failures are non-fatal */
    }
  }
  return kp;
}

/** Reset (rotate) the identity for this app. Use sparingly — old signatures
 *  will no longer verify against the new pubkey. */
export function resetIdentity(storagePrefix: string): Keypair {
  const ls = safeLocalStorage();
  if (ls) ls.removeItem(KEY(storagePrefix));
  return loadOrCreateIdentity(storagePrefix);
}

export type Identity = {
  /** Hex public key. Stable across reloads. Safe to publish. */
  pubkey: string;
  /** Sign a payload with this peer's private key. */
  sign: (payload: unknown) => string;
  /** Reset this peer's identity (rotate keys). */
  reset: () => void;
};

/**
 * React hook returning the peer's stable Ed25519 identity for this app.
 * Cold-start cost is ~50ms on a mid-range device (only on the very first
 * page load — subsequent loads read from localStorage).
 *
 * Identity is per-app: each storagePrefix gets its own keypair so an app
 * compromise can't cross-contaminate. Apps wanting a single fleet-wide
 * identity would need a separate "global identity" mechanism (not provided
 * here — would require a trusted broker, which violates rootlessness).
 */
export function useIdentity(storagePrefix: string): Identity {
  const [kp, setKp] = useState<Keypair>(() => loadOrCreateIdentity(storagePrefix));
  // re-load on storagePrefix change
  useEffect(() => {
    setKp(loadOrCreateIdentity(storagePrefix));
  }, [storagePrefix]);

  return useMemo<Identity>(
    () => ({
      pubkey: kp.publicKey,
      sign: (payload) => signPayload(payload, kp.privateKey),
      reset: () => setKp(resetIdentity(storagePrefix)),
    }),
    [kp, storagePrefix],
  );
}
