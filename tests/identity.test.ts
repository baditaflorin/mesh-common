import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  generateKeypair,
  loadOrCreateIdentity,
  resetIdentity,
  signPayload,
  verifyPayload,
  hashPayload,
} from "../src/identity";

// Minimal localStorage shim for node-environment tests.
const memStore = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k: string, v: string) => memStore.set(k, v),
  removeItem: (k: string) => memStore.delete(k),
  clear: () => memStore.clear(),
  key: (i: number) => Array.from(memStore.keys())[i] ?? null,
  get length() {
    return memStore.size;
  },
});

describe("identity", () => {
  it("generates a fresh hex keypair", () => {
    const kp = generateKeypair();
    expect(kp.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.publicKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateKeypair is non-deterministic", () => {
    expect(generateKeypair().privateKey).not.toBe(generateKeypair().privateKey);
  });

  it("sign + verify roundtrips with the matching pubkey", () => {
    const kp = generateKeypair();
    const sig = signPayload({ hello: "world", n: 1 }, kp.privateKey);
    expect(sig).toMatch(/^[0-9a-f]+$/);
    expect(verifyPayload({ hello: "world", n: 1 }, sig, kp.publicKey)).toBe(true);
  });

  it("verify rejects a tampered payload", () => {
    const kp = generateKeypair();
    const sig = signPayload({ hello: "world" }, kp.privateKey);
    expect(verifyPayload({ hello: "WORLD" }, sig, kp.publicKey)).toBe(false);
  });

  it("verify rejects with a different pubkey", () => {
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const sig = signPayload({ hi: 1 }, kp1.privateKey);
    expect(verifyPayload({ hi: 1 }, sig, kp2.publicKey)).toBe(false);
  });

  it("verify returns false (not throws) on garbage input", () => {
    expect(verifyPayload({ x: 1 }, "not-hex", "also-bad")).toBe(false);
    expect(verifyPayload({ x: 1 }, "", "")).toBe(false);
  });

  it("hashPayload is deterministic and canonical (sorted keys)", () => {
    const h1 = hashPayload({ a: 1, b: 2 });
    const h2 = hashPayload({ b: 2, a: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  describe("loadOrCreateIdentity + resetIdentity", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("creates a keypair on first call and persists it", () => {
      const kp = loadOrCreateIdentity("test-app");
      expect(kp.privateKey).toMatch(/^[0-9a-f]{64}$/);
      const again = loadOrCreateIdentity("test-app");
      expect(again.privateKey).toBe(kp.privateKey);
      expect(again.publicKey).toBe(kp.publicKey);
    });

    it("each app gets a distinct identity", () => {
      const a = loadOrCreateIdentity("app-a");
      const b = loadOrCreateIdentity("app-b");
      expect(a.privateKey).not.toBe(b.privateKey);
    });

    it("resetIdentity rotates the key", () => {
      const before = loadOrCreateIdentity("test-app");
      const after = resetIdentity("test-app");
      expect(after.privateKey).not.toBe(before.privateKey);
      // Old signatures must NOT verify against new pubkey
      const sig = signPayload({ x: 1 }, before.privateKey);
      expect(verifyPayload({ x: 1 }, sig, after.publicKey)).toBe(false);
    });
  });
});
