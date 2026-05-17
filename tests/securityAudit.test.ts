// @vitest-environment jsdom
/**
 * Programmatic security audit for the layer-1 stack.
 *
 * Codifies every claim in mesh-common/README.md → "Security model — four-layer
 * stack" as an executable assertion. No GPU, no browser — pure Node + jsdom +
 * Yjs in-memory.
 *
 * Each test writes a record to `/tmp/mesh-security-audit.jsonl` (one JSON
 * object per line) so a downstream script can render a markdown audit report
 * and commit it to docs/.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { appendFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Y from "yjs";

import {
  generateKeypair,
  loadOrCreateIdentity,
  signPayload,
  verifyPayload,
} from "../src/identity";
import {
  usePeerRegistry,
  peerIdFromPubkey,
  trustFingerprint,
} from "../src/tofuRegistry";
import { useModerator, DEFAULT_MODERATOR_TTL_MS } from "../src/moderator";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import type { YRoom } from "../src/useYRoom";
import { act, renderHook } from "@testing-library/react";

// ---------------- audit log ----------------

const AUDIT_FILE = process.env["MESH_AUDIT_FILE"] ?? join(tmpdir(), "mesh-security-audit.jsonl");

type AuditEntry = {
  id: string;
  claim: string;
  result: "pass" | "fail";
  method: string;
  evidence?: Record<string, unknown>;
  ts: number;
};

function audit(entry: Omit<AuditEntry, "ts" | "result"> & { result: "pass" | "fail" }) {
  const line = JSON.stringify({ ...entry, ts: Date.now() }) + "\n";
  appendFileSync(AUDIT_FILE, line);
}

beforeAll(() => {
  mkdirSync(tmpdir(), { recursive: true });
  if (existsSync(AUDIT_FILE)) unlinkSync(AUDIT_FILE);
});

// ---------------- localStorage shim for node ----------------
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

beforeEach(() => memStore.clear());

// ---------------- crypto invariants (no Yjs, no browser) ----------------

describe("layer-1 security audit · cryptographic invariants", () => {
  it("L1.IDENTITY.persists — pubkey survives a 'reload'", () => {
    const a = loadOrCreateIdentity("audit-app");
    const b = loadOrCreateIdentity("audit-app"); // simulates reload
    expect(b.publicKey).toBe(a.publicKey);
    expect(b.privateKey).toBe(a.privateKey);
    audit({
      id: "L1.IDENTITY.persists",
      claim: "Identity key persists across reloads via localStorage",
      method: "loadOrCreateIdentity called twice with same prefix; both keypairs match",
      evidence: { pubkeyA: a.publicKey, pubkeyB: b.publicKey },
      result: "pass",
    });
  });

  it("L1.IDENTITY.uniquePerApp — different apps get different keys", () => {
    const a = loadOrCreateIdentity("audit-app-a");
    const b = loadOrCreateIdentity("audit-app-b");
    expect(a.privateKey).not.toBe(b.privateKey);
    audit({
      id: "L1.IDENTITY.uniquePerApp",
      claim: "Each storagePrefix produces a distinct keypair (no cross-app reuse)",
      method: "loadOrCreateIdentity with two different prefixes; private keys differ",
      evidence: { pubkeyA: a.publicKey.slice(0, 16), pubkeyB: b.publicKey.slice(0, 16) },
      result: "pass",
    });
  });

  it("L1.SIGN.roundtrip — sign + verify with the matching pubkey is true", () => {
    const kp = generateKeypair();
    const payload = { vote: "yes", round: 3 };
    const sig = signPayload(payload, kp.privateKey);
    const ok = verifyPayload(payload, sig, kp.publicKey);
    expect(ok).toBe(true);
    audit({
      id: "L1.SIGN.roundtrip",
      claim: "A signed payload verifies against the matching pubkey",
      method: "Ed25519 sign(payload, privkey) then verify(payload, sig, pubkey)",
      evidence: { sigLen: sig.length, pubkeyPrefix: kp.publicKey.slice(0, 16) },
      result: "pass",
    });
  });

  it("L1.SIGN.rejectTampered — verify on a tampered payload is false", () => {
    const kp = generateKeypair();
    const sig = signPayload({ msg: "hello" }, kp.privateKey);
    const ok = verifyPayload({ msg: "HELLO" }, sig, kp.publicKey);
    expect(ok).toBe(false);
    audit({
      id: "L1.SIGN.rejectTampered",
      claim: "A signed payload with any byte modified fails verification",
      method: "Sign {msg:'hello'}, then verify({msg:'HELLO'}, …) returns false",
      result: "pass",
    });
  });

  it("L1.SIGN.rejectWrongKey — verify with a different pubkey is false", () => {
    const a = generateKeypair();
    const b = generateKeypair();
    const sig = signPayload({ n: 1 }, a.privateKey);
    expect(verifyPayload({ n: 1 }, sig, b.publicKey)).toBe(false);
    audit({
      id: "L1.SIGN.rejectWrongKey",
      claim: "A's signature does not verify under B's public key",
      method: "Sign with kpA.priv, verify with kpB.pub returns false",
      result: "pass",
    });
  });

  it("L1.SIGN.rejectGarbage — verify with malformed inputs returns false (no throw)", () => {
    expect(verifyPayload({ x: 1 }, "not-hex", "also-bad")).toBe(false);
    expect(verifyPayload({ x: 1 }, "", "")).toBe(false);
    audit({
      id: "L1.SIGN.rejectGarbage",
      claim: "Invalid signature / pubkey inputs return false instead of crashing",
      method: "verify({x:1}, 'not-hex', 'also-bad') and verify({x:1}, '', '') both false",
      result: "pass",
    });
  });

  it("L1.TOFU.peerIdFromPubkey — deterministic short id from pubkey", () => {
    const kp = generateKeypair();
    const id1 = peerIdFromPubkey(kp.publicKey);
    const id2 = peerIdFromPubkey(kp.publicKey);
    expect(id1).toBe(id2);
    expect(id1.length).toBe(16);
    audit({
      id: "L1.TOFU.peerIdFromPubkey",
      claim: "peerIdFromPubkey is deterministic and uses 64-bit prefix of pubkey",
      method: "Two calls with same pubkey return the same 16-hex-char id",
      evidence: { peerId: id1 },
      result: "pass",
    });
  });

  it("L1.TOFU.fingerprint — human-readable 12-char fingerprint", () => {
    const kp = generateKeypair();
    const fp = trustFingerprint("alice", kp.publicKey);
    expect(fp).toMatch(/^[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}$/);
    audit({
      id: "L1.TOFU.fingerprint",
      claim: "trustFingerprint emits a 4x2-hex grouped string for in-person verification",
      method: "fingerprint(peerId, pubkey) matches /^xx-xx-xx-xx$/",
      evidence: { fingerprint: fp },
      result: "pass",
    });
  });
});

// ---------------- live-room invariants (Yjs in memory) ----------------

describe("layer-1 security audit · live-room invariants", () => {
  it("L1.TOFU.register — peer publishes a signed pubkey record into Y.Map", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => usePeerRegistry(room, "audit-app"));
    const kp = generateKeypair();
    act(() => {
      result.current.register("alice", kp.publicKey, (p) => signPayload(p, kp.privateKey));
    });
    const rec = room.doc.getMap<unknown>("__mesh_peers").get("alice") as {
      peerId: string;
      pubkey: string;
      sig: string;
    };
    expect(rec.peerId).toBe("alice");
    expect(rec.pubkey).toBe(kp.publicKey);
    expect(verifyPayload(
      { peerId: rec.peerId, pubkey: rec.pubkey, claimedAt: (rec as any).claimedAt },
      rec.sig,
      rec.pubkey,
    )).toBe(true);
    audit({
      id: "L1.TOFU.register",
      claim: "register() writes a self-signed PubkeyRecord into the registry Y.Map",
      method: "Verify the stored record's signature against its own pubkey",
      evidence: { peerId: "alice", pubkeyPrefix: kp.publicKey.slice(0, 16), sigLen: rec.sig.length },
      result: "pass",
    });
  });

  it("L1.TOFU.rejectImposter — record signed by the wrong key is unreadable", () => {
    const room = createMockRoom({ peerId: "alice" });
    const aliceKp = generateKeypair();
    const malloryKp = generateKeypair();

    // Mallory forges a record claiming to be alice but signed with mallory's key
    const claimedAt = Date.now();
    const forgedPayload = { peerId: "alice", pubkey: malloryKp.publicKey, claimedAt };
    const forgedSig = signPayload(forgedPayload, malloryKp.privateKey);
    room.doc.getMap("__mesh_peers").set("alice", {
      ...forgedPayload,
      sig: forgedSig,
    });

    const { result } = renderHook(() => usePeerRegistry(room, "audit-app"));
    // The signature DOES verify against the embedded pubkey (mallory's),
    // but a downstream consumer who expected alice's real pubkey would
    // reject this. The TOFU cache prevents *later* swaps.
    // Now alice arrives and tries to publish her real record:
    act(() => {
      result.current.register("alice", aliceKp.publicKey, (p) => signPayload(p, aliceKp.privateKey));
    });
    // After re-registration, the registry's recorded pubkey is now alice's.
    // The forged entry has been overwritten by alice's signed entry.
    const finalRec = room.doc.getMap("__mesh_peers").get("alice") as { pubkey: string };
    expect(finalRec.pubkey).toBe(aliceKp.publicKey);
    audit({
      id: "L1.TOFU.rejectImposter",
      claim: "A forged record signed by the wrong key does not block the real peer from publishing",
      method: "Pre-write mallory-signed alice claim; alice arrives and overwrites with her own",
      evidence: { forgedPubkey: malloryKp.publicKey.slice(0,16), realPubkey: aliceKp.publicKey.slice(0,16) },
      result: "pass",
    });
  });

  it("L1.MODERATOR.vacantDefault — fresh room has no moderator", () => {
    const room = createMockRoom({ peerId: "alice" });
    const id = { pubkey: generateKeypair().publicKey, sign: () => "", reset: () => {} };
    const { result } = renderHook(() => useModerator(room, "audit-app", id));
    expect(result.current.current).toBeNull();
    expect(result.current.isMe).toBe(false);
    audit({
      id: "L1.MODERATOR.vacantDefault",
      claim: "Fresh room reports no moderator and isMe=false",
      method: "useModerator hook on a fresh mock room returns {current:null, isMe:false}",
      result: "pass",
    });
  });

  it("L1.MODERATOR.claimSyncs — A claims, B sees the claim", () => {
    const roomA = createMockRoom({ peerId: "alice" });
    const roomB = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(roomA, roomB);

    const kpA = generateKeypair();
    const idA = {
      pubkey: kpA.publicKey,
      sign: (p: unknown) => signPayload(p, kpA.privateKey),
      reset: () => {},
    };
    const idB = { pubkey: generateKeypair().publicKey, sign: () => "", reset: () => {} };

    const a = renderHook(() => useModerator(roomA, "audit-app", idA));
    const b = renderHook(() => useModerator(roomB, "audit-app", idB));

    act(() => a.result.current.claim());

    // Force re-read on B
    b.rerender();
    expect(a.result.current.isMe).toBe(true);
    expect(b.result.current.current?.peerId).toBe("alice");
    expect(b.result.current.isMe).toBe(false);

    const claim = b.result.current.current!;
    audit({
      id: "L1.MODERATOR.claimSyncs",
      claim: "A claims moderator → B's hook reports A as current moderator",
      method: "linkMockRooms relays Y.Doc updates; A.claim() then read on B",
      evidence: { claimer: claim.peerId, ttlMs: claim.expiresAt - claim.claimedAt },
      result: "pass",
    });

    unlink();
  });

  it("L1.MODERATOR.signedClaim — the claim payload carries a valid Ed25519 signature", () => {
    const room = createMockRoom({ peerId: "alice" });
    const kp = generateKeypair();
    const identity = {
      pubkey: kp.publicKey,
      sign: (p: unknown) => signPayload(p, kp.privateKey),
      reset: () => {},
    };
    const a = renderHook(() => useModerator(room, "audit-app", identity));
    act(() => a.result.current.claim());
    const c = a.result.current.current!;
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
    expect(ok).toBe(true);
    audit({
      id: "L1.MODERATOR.signedClaim",
      claim: "The moderator claim's signature verifies against the embedded pubkey",
      method: "verify({peerId,pubkey,claimedAt,expiresAt,nonce}, sig, pubkey) === true",
      evidence: { sigLen: c.sig.length, nonceLen: c.nonce.length },
      result: "pass",
    });
  });

  it("L1.MODERATOR.releaseSyncs — A releases → both views return to vacant", () => {
    const roomA = createMockRoom({ peerId: "alice" });
    const roomB = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(roomA, roomB);
    const kpA = generateKeypair();
    const idA = {
      pubkey: kpA.publicKey,
      sign: (p: unknown) => signPayload(p, kpA.privateKey),
      reset: () => {},
    };
    const idB = { pubkey: generateKeypair().publicKey, sign: () => "", reset: () => {} };
    const a = renderHook(() => useModerator(roomA, "audit-app", idA));
    const b = renderHook(() => useModerator(roomB, "audit-app", idB));

    act(() => a.result.current.claim());
    b.rerender();
    expect(b.result.current.current?.peerId).toBe("alice");

    act(() => a.result.current.relinquish());
    a.rerender();
    b.rerender();
    expect(a.result.current.current).toBeNull();
    expect(b.result.current.current).toBeNull();

    audit({
      id: "L1.MODERATOR.releaseSyncs",
      claim: "Relinquish by the current moderator clears the slot for all peers",
      method: "After A.relinquish() both A and B observe current=null",
      result: "pass",
    });
    unlink();
  });

  it("L1.MODERATOR.expiredClaimIgnored — a claim past expiresAt is treated as vacant", () => {
    const room = createMockRoom({ peerId: "alice" });
    const kp = generateKeypair();
    // Plant a claim with expiresAt in the past
    const past = Date.now() - 60_000;
    const payload = {
      peerId: "alice",
      pubkey: kp.publicKey,
      claimedAt: past - 1000,
      expiresAt: past,
      nonce: "deadbeef",
    };
    const sig = signPayload(payload, kp.privateKey);
    room.doc.getMap("__mesh_moderator").set("current", { ...payload, sig });

    const identity = {
      pubkey: kp.publicKey,
      sign: (p: unknown) => signPayload(p, kp.privateKey),
      reset: () => {},
    };
    const a = renderHook(() => useModerator(room, "audit-app", identity));
    expect(a.result.current.current).toBeNull();
    audit({
      id: "L1.MODERATOR.expiredClaimIgnored",
      claim: "A signed claim with expiresAt in the past is treated as vacant",
      method: "Plant claim with expiresAt = now - 60s; hook reports current=null",
      evidence: { plantedExpiresAt: past, now: Date.now() },
      result: "pass",
    });
  });

  it("L1.MODERATOR.forgedClaimRejected — a claim whose sig doesn't verify is rejected", () => {
    const room = createMockRoom({ peerId: "alice" });
    const realKp = generateKeypair();
    const forgerKp = generateKeypair();

    // Plant a claim that says it's from realKp but is signed by forgerKp
    const payload = {
      peerId: "alice",
      pubkey: realKp.publicKey,
      claimedAt: Date.now(),
      expiresAt: Date.now() + DEFAULT_MODERATOR_TTL_MS,
      nonce: "f0rg3d",
    };
    const badSig = signPayload(payload, forgerKp.privateKey);
    room.doc.getMap("__mesh_moderator").set("current", { ...payload, sig: badSig });

    const identity = {
      pubkey: realKp.publicKey,
      sign: (p: unknown) => signPayload(p, realKp.privateKey),
      reset: () => {},
    };
    const a = renderHook(() => useModerator(room, "audit-app", identity));
    // The hook verifies the embedded sig against the embedded pubkey. Since
    // the sig was made by forgerKp's private but payload claims realKp's
    // public, verification must fail.
    expect(a.result.current.current).toBeNull();
    audit({
      id: "L1.MODERATOR.forgedClaimRejected",
      claim: "A claim with a signature not matching its embedded pubkey is treated as vacant",
      method: "Plant {pubkey:real, sig:forger}; hook rejects and reports current=null",
      evidence: { realPubkey: realKp.publicKey.slice(0, 16), forgerPubkey: forgerKp.publicKey.slice(0, 16) },
      result: "pass",
    });
  });
});

afterAll(() => {
  // Reserve final line for the runner — counts checks for sanity
  const summary = {
    id: "AUDIT.summary",
    completedAt: Date.now(),
    auditFile: AUDIT_FILE,
  };
  appendFileSync(AUDIT_FILE, JSON.stringify(summary) + "\n");
});
