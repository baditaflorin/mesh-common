// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeypair, signPayload, type Identity } from "../src/identity";
import { DEFAULT_MODERATOR_TTL_MS, useModerator, type ModeratorClaim } from "../src/moderator";
import { useSignedWrite, type SignedRecord } from "../src/security/useSignedWrite";
import type { PubkeyRecord } from "../src/tofuRegistry";
import type { YRoom } from "../src/useYRoom";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

/**
 * A hostile peer controls its own client, so it can write anything into the
 * shared Y.Doc. These tests write such records directly and check that the
 * honest reader's verification rejects them.
 */

type Vote = { choice: string };

function makeIdentity(): Identity & { privateKey: string } {
  const kp = generateKeypair();
  return {
    pubkey: kp.publicKey,
    privateKey: kp.privateKey,
    sign: (p) => signPayload(p, kp.privateKey),
    reset: () => undefined,
  };
}

/**
 * Write a record signed exactly as an honest client signs it for this room,
 * map and key, so only the registry check can reject it.
 */
function forgeRecord(
  room: YRoom,
  map: string,
  key: string,
  peerId: string,
  id: ReturnType<typeof makeIdentity>,
  payload: Vote,
) {
  const ts = Date.now();
  const envelope = {
    domain: "mesh-common/signed-write/v2",
    room: room.roomId,
    map,
    key,
    payload,
    peerId,
    ts,
  };
  const record: SignedRecord<Vote> = { payload, peerId, pubkey: id.pubkey, ts, sig: id.sign(envelope) };
  room.doc.getMap<SignedRecord<Vote>>(map).set(key, record);
}

/** Publish a self-signed registry entry, as any peer (honest or not) can. */
function publishRegistryEntry(room: YRoom, peerId: string, id: ReturnType<typeof makeIdentity>) {
  const claimedAt = Date.now();
  const body = { peerId, pubkey: id.pubkey, claimedAt };
  room.doc.getMap<PubkeyRecord>("__mesh_peers").set(peerId, { ...body, sig: id.sign(body) });
}

let alice: YRoom;
let bob: YRoom;
let unlink: () => void;

beforeEach(() => {
  sessionStorage.clear();
  alice = createMockRoom({ peerId: "alice", roomId: "r1" });
  bob = createMockRoom({ peerId: "bob", roomId: "r1" });
  unlink = linkMockRooms(alice, bob);
});

afterEach(() => {
  cleanup();
  unlink();
});

/** Alice casts an honest vote, Bob reads it (pinning her key), then Alice leaves. */
function honestVote(aliceId: Identity) {
  const writer = renderHook(() => useSignedWrite<Vote>(alice, "votes", aliceId));
  act(() => writer.result.current.setSigned("round-1", { choice: "yes" }));
  writer.unmount();
  const reader = renderHook(() => useSignedWrite<Vote>(bob, "votes", null));
  expect(reader.result.current.getVerified("round-1")).toEqual({ choice: "yes" });
  return reader;
}

describe("useSignedWrite against a hostile peer", () => {
  it("accepts an honest signed write from another peer", () => {
    honestVote(makeIdentity());
  });

  it("rejects a self-signed record from a peer with no registry entry", () => {
    act(() => forgeRecord(alice, "votes", "round-1", "carol", makeIdentity(), { choice: "no" }));
    const reader = renderHook(() => useSignedWrite<Vote>(bob, "votes", null));
    expect(reader.result.current.getVerified("round-1")).toBeNull();
  });

  it("rejects a forged record after the impostor overwrites the victim's registry entry", () => {
    const reader = honestVote(makeIdentity());
    const mallory = makeIdentity();
    act(() => {
      publishRegistryEntry(alice, "alice", mallory);
      forgeRecord(alice, "votes", "round-1", "alice", mallory, { choice: "no" });
    });
    expect(reader.result.current.getVerified("round-1")).toBeNull();
  });

  it("rejects a valid record replayed under another key", () => {
    const reader = honestVote(makeIdentity());
    act(() => {
      const votes = alice.doc.getMap<SignedRecord<Vote>>("votes");
      votes.set("round-2", { ...votes.get("round-1")! });
    });
    expect(reader.result.current.getVerified("round-2")).toBeNull();
  });

  it("rejects a valid record replayed into another map", () => {
    honestVote(makeIdentity());
    act(() => {
      const rec = alice.doc.getMap<SignedRecord<Vote>>("votes").get("round-1")!;
      alice.doc.getMap<SignedRecord<Vote>>("vetoes").set("round-1", { ...rec });
    });
    const reader = renderHook(() => useSignedWrite<Vote>(bob, "vetoes", null));
    expect(reader.result.current.getVerified("round-1")).toBeNull();
  });

  it("rejects a valid record replayed into another room", () => {
    honestVote(makeIdentity());
    const other = createMockRoom({ peerId: "dave", roomId: "r2" });
    act(() => {
      const reg = alice.doc.getMap<PubkeyRecord>("__mesh_peers").get("alice")!;
      const rec = alice.doc.getMap<SignedRecord<Vote>>("votes").get("round-1")!;
      other.doc.getMap<PubkeyRecord>("__mesh_peers").set("alice", { ...reg });
      other.doc.getMap<SignedRecord<Vote>>("votes").set("round-1", { ...rec });
    });
    const reader = renderHook(() => useSignedWrite<Vote>(other, "votes", null));
    expect(reader.result.current.getVerified("round-1")).toBeNull();
  });
});

describe("useModerator against a hostile peer", () => {
  function writeClaim(
    room: YRoom,
    peerId: string,
    id: ReturnType<typeof makeIdentity>,
    claimedAt: number,
    expiresAt: number,
  ) {
    const body = { peerId, pubkey: id.pubkey, claimedAt, expiresAt, nonce: "00" };
    const claim: ModeratorClaim = { ...body, sig: id.sign(body) };
    room.doc.getMap<ModeratorClaim>("__mesh_moderator").set("current", claim);
  }

  it("shows an honest claim to other peers", () => {
    const aliceMod = renderHook(() => useModerator(alice, "mod", makeIdentity()));
    act(() => aliceMod.result.current.claim());
    const bobMod = renderHook(() => useModerator(bob, "mod", makeIdentity()));
    expect(bobMod.result.current.current?.peerId).toBe("alice");
    expect(aliceMod.result.current.isMe).toBe(true);
  });

  it("rejects a self-signed claim from a peer with no registry entry", () => {
    act(() => writeClaim(alice, "carol", makeIdentity(), Date.now(), Date.now() + 60_000));
    const bobMod = renderHook(() => useModerator(bob, "mod", makeIdentity()));
    expect(bobMod.result.current.current).toBeNull();
  });

  it("rejects a registered claimant that grants itself more than one TTL", () => {
    const mallory = makeIdentity();
    const now = Date.now();
    act(() => {
      publishRegistryEntry(alice, "mallory", mallory);
      writeClaim(alice, "mallory", mallory, now, now + 365 * 24 * 3600_000);
    });
    const bobMod = renderHook(() => useModerator(bob, "mod", makeIdentity()));
    expect(bobMod.result.current.current).toBeNull();
  });

  it("rejects a claim dated in the future to outlast the TTL", () => {
    const mallory = makeIdentity();
    const later = Date.now() + 24 * 3600_000;
    act(() => {
      publishRegistryEntry(alice, "mallory", mallory);
      writeClaim(alice, "mallory", mallory, later, later + DEFAULT_MODERATOR_TTL_MS);
    });
    const bobMod = renderHook(() => useModerator(bob, "mod", makeIdentity()));
    expect(bobMod.result.current.current).toBeNull();
  });

  it("still expires an honest claim after the TTL", () => {
    vi.useFakeTimers();
    try {
      const aliceMod = renderHook(() => useModerator(alice, "mod", makeIdentity(), { ttlMs: 1000 }));
      act(() => aliceMod.result.current.claim());
      const bobMod = renderHook(() => useModerator(bob, "mod", makeIdentity(), { ttlMs: 1000 }));
      expect(bobMod.result.current.current?.peerId).toBe("alice");
      act(() => vi.advanceTimersByTime(2000));
      expect(bobMod.result.current.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
