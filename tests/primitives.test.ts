// @vitest-environment jsdom
/**
 * Unit tests for the 10 mesh-common primitives extracted on 2026-05-17.
 * Uses @testing-library/react's renderHook + createMockRoom / linkMockRooms
 * to verify both single-peer behavior and two-peer mesh sync.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMeshConfig } from "../src/MeshConfig";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import { useNamedPeer } from "../src/useNamedPeer";
import { useEventLog } from "../src/useEventLog";
import { useVotes } from "../src/useVotes";
import { usePhase } from "../src/usePhase";
import { useCommitRevealHook } from "../src/useCommitRevealHook";
import { useMeshSlot } from "../src/useMeshSlot";
import { useFairRng } from "../src/useFairRng";
import { pushToast } from "../src/MeshToasts";

// localStorage shim for jsdom (jsdom has one, but be defensive)
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  get length() {
    return mem.size;
  },
});

beforeEach(() => mem.clear());

const cfg = (prefix: string) =>
  createMeshConfig({
    appName: prefix,
    description: "",
    accentHex: "#fff",
    version: "0.0.1",
    commit: "test",
  });

describe("useNamedPeer", () => {
  it("persists name to localStorage and publishes to Y.Map names", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useNamedPeer(cfg("audit"), room));
    act(() => result.current.setName("alice"));
    expect(localStorage.getItem("audit:displayName")).toBe("alice");
    const remoteNames = room.doc.getMap<string>("__mesh_names");
    expect(remoteNames.get("alice")).toBe("alice");
  });

  it("two peers see each other's names", () => {
    const roomA = createMockRoom({ peerId: "alice" });
    const roomB = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(roomA, roomB);
    const a = renderHook(() => useNamedPeer(cfg("audit-a"), roomA));
    const b = renderHook(() => useNamedPeer(cfg("audit-b"), roomB));
    act(() => a.result.current.setName("alice"));
    act(() => b.result.current.setName("bob"));
    b.rerender();
    expect(b.result.current.nameOf("alice")).toBe("alice");
    a.rerender();
    expect(a.result.current.nameOf("bob")).toBe("bob");
    unlink();
  });

  it("falls back to peer-<short> when no name set", () => {
    const room = createMockRoom({ peerId: "abc123xyz" });
    const { result } = renderHook(() => useNamedPeer(cfg("audit"), room));
    expect(result.current.myName).toBe("peer-abc123");
  });
});

describe("useEventLog", () => {
  it("appends events and exposes latest / byPeer filters", () => {
    type Ev = { peerId: string; kind: string; ts: number };
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() => useEventLog<Ev>(room, "log"));
    act(() => result.current.push({ peerId: "alice", kind: "x", ts: 1 }));
    act(() => result.current.push({ peerId: "bob", kind: "y", ts: 2 }));
    act(() => result.current.push({ peerId: "alice", kind: "z", ts: 3 }));
    rerender();
    expect(result.current.size).toBe(3);
    expect(result.current.byPeer("alice").map((e) => e.kind)).toEqual(["x", "z"]);
    expect(result.current.latest(2).map((e) => e.kind)).toEqual(["z", "y"]);
  });

  it("clear() empties the log on all peers", () => {
    const roomA = createMockRoom({ peerId: "alice" });
    const roomB = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(roomA, roomB);
    type Ev = { peerId: string; n: number };
    const a = renderHook(() => useEventLog<Ev>(roomA, "log"));
    const b = renderHook(() => useEventLog<Ev>(roomB, "log"));
    act(() => a.result.current.push({ peerId: "alice", n: 1 }));
    b.rerender();
    expect(b.result.current.size).toBe(1);
    act(() => a.result.current.clear());
    b.rerender();
    expect(b.result.current.size).toBe(0);
    unlink();
  });
});

describe("useVotes", () => {
  it("counts votes, finds winner, gives my vote back", () => {
    const roomA = createMockRoom({ peerId: "alice" });
    const roomB = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(roomA, roomB);
    const a = renderHook(() => useVotes<"yes" | "no">(roomA, "vote"));
    const b = renderHook(() => useVotes<"yes" | "no">(roomB, "vote"));
    act(() => a.result.current.vote("yes"));
    act(() => b.result.current.vote("no"));
    a.rerender();
    b.rerender();
    expect(a.result.current.myVote).toBe("yes");
    expect(b.result.current.myVote).toBe("no");
    expect(a.result.current.totalVotes).toBe(2);
    expect(a.result.current.tally.get("yes")).toBe(1);
    expect(a.result.current.tally.get("no")).toBe(1);
    expect(a.result.current.pctOf("yes")).toBe(50);
    unlink();
  });

  it("unvote removes my entry", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() => useVotes<"a" | "b">(room, "v"));
    act(() => result.current.vote("a"));
    rerender();
    expect(result.current.totalVotes).toBe(1);
    act(() => result.current.unvote());
    rerender();
    expect(result.current.totalVotes).toBe(0);
    expect(result.current.myVote).toBeNull();
  });
});

describe("usePhase", () => {
  it("transitions between phases and bumps epoch", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() =>
      usePhase<"lobby" | "playing" | "done">(room, "p", "lobby"),
    );
    expect(result.current.phase).toBe("lobby");
    expect(result.current.epoch).toBe(0);
    act(() => {
      result.current.transition("playing");
    });
    rerender();
    expect(result.current.phase).toBe("playing");
    expect(result.current.epoch).toBe(1);
    act(() => {
      result.current.transition("done");
    });
    rerender();
    expect(result.current.epoch).toBe(2);
  });

  it("transition with from-guard rejects from wrong state", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() =>
      usePhase<"lobby" | "playing">(room, "p", "lobby"),
    );
    let ok = true;
    act(() => {
      ok = result.current.transition("playing", { from: "playing" });
    });
    rerender();
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("lobby");
  });
});

describe("useCommitRevealHook", () => {
  it("commit + reveal lifecycle + verify", async () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() =>
      useCommitRevealHook<{ choice: string }>(room, "audit", "round1"),
    );
    expect(result.current.status).toBe("idle");
    await act(async () => {
      await result.current.commit({ choice: "rock" });
    });
    rerender();
    expect(result.current.status).toBe("committed");
    expect(result.current.myHash).toMatch(/^[0-9a-f]+$/);

    await act(async () => {
      await result.current.reveal();
    });
    rerender();
    expect(result.current.status).toBe("revealed");
    expect(result.current.myReveal).toEqual({ choice: "rock" });

    // Trigger one more render cycle so the verify-effect resolves
    await new Promise((r) => setTimeout(r, 20));
    rerender();
    expect(result.current.verified).toBe(true);
  });
});

describe("useMeshSlot", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns slotId and remaining time for a fake clock", () => {
    const fakeClock = { meshNow: () => 12_345, destroy: () => {} } as any;
    const { result } = renderHook(() => useMeshSlot(fakeClock, 5000));
    expect(result.current.slotId).toBe(2); // floor(12345/5000)
    expect(result.current.slotStart).toBe(10_000);
    expect(result.current.slotMsRemaining).toBe(2655);
    expect(result.current.progress).toBeCloseTo(0.469, 2);
  });
});

describe("useFairRng", () => {
  it("derives a deterministic seed once contributors arrive", () => {
    const roomA = createMockRoom({ peerId: "alice" });
    const roomB = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(roomA, roomB);
    const a = renderHook(() => useFairRng(roomA, "round1", { minContributors: 2 }));
    a.rerender();
    expect(a.result.current.ready).toBe(false);
    // bob arrives
    const b = renderHook(() => useFairRng(roomB, "round1", { minContributors: 2 }));
    b.rerender();
    a.rerender();
    expect(a.result.current.contributors).toBe(2);
    expect(a.result.current.ready).toBe(true);
    expect(a.result.current.seed).toBeGreaterThanOrEqual(0);
    // Same seed on both peers
    expect(b.result.current.seed).toBe(a.result.current.seed);
    // Same shuffle on both peers
    const arr = [1, 2, 3, 4, 5];
    expect(a.result.current.shuffle(arr)).toEqual(b.result.current.shuffle(arr));
    unlink();
  });
});

describe("MeshToasts integration", () => {
  it("pushToast appends to the Y.Array and other peers see it", () => {
    const roomA = createMockRoom({ peerId: "alice" });
    const roomB = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(roomA, roomB);
    pushToast(roomA, "round started");
    const toasts = roomB.doc.getArray("__mesh_toasts").toArray() as Array<{
      msg: string;
      peerId: string;
    }>;
    expect(toasts.length).toBe(1);
    expect(toasts[0]?.msg).toBe("round started");
    expect(toasts[0]?.peerId).toBe("alice");
    unlink();
  });
});
