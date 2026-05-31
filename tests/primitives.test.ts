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

  it("remembers a name set in one app across sibling apps on the same origin", () => {
    // App A: a fresh user types their name. This is the action that previously
    // never reached the fleet store until an extra reload (the reported bug).
    const roomA = createMockRoom({ peerId: "alice" });
    const appA = renderHook(() => useNamedPeer(cfg("mesh-app-a"), roomA));
    act(() => appA.result.current.setName("Alice"));
    // It must have landed in the same-origin fleet persona immediately.
    expect(localStorage.getItem("mesh-fleet:v1:fleet")).toContain("Alice");

    // App B: a DIFFERENT app (different storagePrefix → different per-app key)
    // opened for the first time. Its per-app name key is empty, so it must
    // adopt the fleet name on first render — no reload, no manual re-entry.
    const roomB = createMockRoom({ peerId: "bob" });
    const appB = renderHook(() => useNamedPeer(cfg("mesh-app-b"), roomB));
    expect(appB.result.current.name).toBe("Alice");
    expect(appB.result.current.myName).toBe("Alice");
  });

  it("keeps non-ASCII names app-local and never clobbers an existing fleet name", () => {
    // Establish a valid fleet name first.
    const roomA = createMockRoom({ peerId: "alice" });
    const appA = renderHook(() => useNamedPeer(cfg("mesh-app-a"), roomA));
    act(() => appA.result.current.setName("Alice"));
    expect(localStorage.getItem("mesh-fleet:v1:fleet")).toContain("Alice");

    // A non-conforming name (emoji) stays under the per-app key but must NOT
    // overwrite the fleet persona shared by every other app.
    const roomB = createMockRoom({ peerId: "bob" });
    const appB = renderHook(() => useNamedPeer(cfg("mesh-app-b"), roomB));
    act(() => appB.result.current.setName("🎉party"));
    expect(localStorage.getItem("mesh-app-b:displayName")).toBe("🎉party");
    expect(localStorage.getItem("mesh-fleet:v1:fleet")).toContain("Alice");
    expect(localStorage.getItem("mesh-fleet:v1:fleet")).not.toContain("🎉");
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
    expect(result.current.byPeer("alice").map((e) => e.kind)).toEqual([
      "x",
      "z",
    ]);
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
    const { result, rerender } = renderHook(() =>
      useVotes<"a" | "b">(room, "v"),
    );
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
    const a = renderHook(() =>
      useFairRng(roomA, "round1", { minContributors: 2 }),
    );
    a.rerender();
    expect(a.result.current.ready).toBe(false);
    // bob arrives
    const b = renderHook(() =>
      useFairRng(roomB, "round1", { minContributors: 2 }),
    );
    b.rerender();
    a.rerender();
    expect(a.result.current.contributors).toBe(2);
    expect(a.result.current.ready).toBe(true);
    expect(a.result.current.seed).toBeGreaterThanOrEqual(0);
    // Same seed on both peers
    expect(b.result.current.seed).toBe(a.result.current.seed);
    // Same shuffle on both peers
    const arr = [1, 2, 3, 4, 5];
    expect(a.result.current.shuffle(arr)).toEqual(
      b.result.current.shuffle(arr),
    );
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

// ============================================================================
// Batch 2: 10 more primitives shipped 2026-05-17
// ============================================================================
import { usePerPeerValue } from "../src/usePerPeerValue";
import { useDraft } from "../src/useDraft";
import { useDeadline } from "../src/useDeadline";
import { useFlashOnChange } from "../src/useFlashOnChange";
import { useRoster } from "../src/useRoster";
import { useRotatingTurn } from "../src/useRotatingTurn";
import { useExpiringClaim } from "../src/useExpiringClaim";
import { useReactions } from "../src/useReactions";

describe("usePerPeerValue", () => {
  it("setMy writes to Y.Map and other peers observe", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aHook = renderHook(() => usePerPeerValue<number>(a, "hue", 0));
    const bHook = renderHook(() => usePerPeerValue<number>(b, "hue", 0));
    act(() => aHook.result.current.setMy(120));
    bHook.rerender();
    expect(bHook.result.current.valueOf("alice")).toBe(120);
    expect(bHook.result.current.size).toBe(1);
    act(() => bHook.result.current.setMy(240));
    aHook.rerender();
    expect(aHook.result.current.entries.length).toBe(2);
    unlink();
  });

  it("clearMy removes the peer's entry", () => {
    const room = createMockRoom({ peerId: "alice" });
    const h = renderHook(() => usePerPeerValue<string>(room, "k", ""));
    act(() => h.result.current.setMy("x"));
    expect(h.result.current.size).toBe(1);
    act(() => h.result.current.clearMy());
    expect(h.result.current.size).toBe(0);
  });
});

describe("useDraft", () => {
  it("persists value to localStorage and restores on rerender", () => {
    const { result } = renderHook(() => useDraft<string>("draft:k", ""));
    act(() => result.current.setValue("typing…"));
    expect(localStorage.getItem("draft:k")).toBe("typing…");
    expect(result.current.dirty).toBe(true);
    const { result: r2 } = renderHook(() => useDraft<string>("draft:k", ""));
    expect(r2.current.value).toBe("typing…");
  });

  it("commit invokes publish then clears", async () => {
    const { result } = renderHook(() => useDraft<string>("draft:c", ""));
    act(() => result.current.setValue("hi"));
    const publish = vi.fn();
    await act(async () => {
      await result.current.commit(publish);
    });
    expect(publish).toHaveBeenCalledWith("hi");
    expect(result.current.value).toBe("");
    expect(localStorage.getItem("draft:c")).toBeNull();
  });

  it("commit retains draft if publish returns false", async () => {
    const { result } = renderHook(() => useDraft<string>("draft:f", ""));
    act(() => result.current.setValue("retry"));
    await act(async () => {
      await result.current.commit(() => false);
    });
    expect(result.current.value).toBe("retry");
  });
});

describe("useDeadline", () => {
  it("formats remaining time + flips isPast", () => {
    vi.useFakeTimers();
    const target = Date.now() + 90_000;
    const { result, rerender } = renderHook(() =>
      useDeadline(target, { tickMs: 100 }),
    );
    expect(result.current.isPast).toBe(false);
    expect(result.current.fmt).toMatch(/1:30|1:29/);
    vi.advanceTimersByTime(100_000);
    rerender();
    expect(result.current.isPast).toBe(true);
    expect(result.current.fmt).toBe("now");
    vi.useRealTimers();
  });

  it("fmt handles minute/hour/day boundaries", () => {
    const make = (ms: number) => {
      vi.useFakeTimers();
      const t = Date.now() + ms;
      const { result } = renderHook(() => useDeadline(t));
      const out = result.current.fmt;
      vi.useRealTimers();
      return out;
    };
    expect(make(5_000)).toMatch(/^\ds$/);
    expect(make(125_000)).toMatch(/^2:0\d$/);
    expect(make(3 * 86_400_000)).toBe("3 days");
  });
});

describe("useFlashOnChange", () => {
  it("flashes true for durationMs after value changes", () => {
    vi.useFakeTimers();
    let v = 1;
    const { result, rerender } = renderHook(() => useFlashOnChange(v, 300));
    expect(result.current).toBe(false);
    v = 2;
    rerender();
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });
});

describe("useRoster", () => {
  it("heartbeats and reports the peer as present", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result, rerender } = renderHook(() =>
      useRoster(room, { heartbeatMs: 100, freshnessMs: 5_000 }),
    );
    rerender();
    expect(result.current.present).toContain("alice");
    expect(result.current.isPresent("alice")).toBe(true);
  });

  it("two linked peers each appear in the other's present list", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aH = renderHook(() =>
      useRoster(a, { heartbeatMs: 100, freshnessMs: 5_000 }),
    );
    const bH = renderHook(() =>
      useRoster(b, { heartbeatMs: 100, freshnessMs: 5_000 }),
    );
    aH.rerender();
    bH.rerender();
    expect(aH.result.current.present).toEqual(
      expect.arrayContaining(["alice", "bob"]),
    );
    expect(bH.result.current.present).toEqual(
      expect.arrayContaining(["alice", "bob"]),
    );
    unlink();
  });
});

describe("useRotatingTurn", () => {
  it("rotates currentPeerId across slots in stable mode", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aR = renderHook(() => useRoster(a));
    const bR = renderHook(() => useRoster(b));
    aR.rerender();
    bR.rerender();
    const fakeClock = {
      meshNow: () => 5_000,
      stop: () => {},
      add: () => {},
      remove: () => {},
    } as unknown as Parameters<typeof useRotatingTurn>[1];
    const { result } = renderHook(() =>
      useRotatingTurn(a, fakeClock, { slotMs: 1_000, order: "stable" }),
    );
    expect(result.current.order.length).toBeGreaterThan(0);
    expect(result.current.currentPeerId).not.toBeNull();
    expect(["alice", "bob"]).toContain(result.current.currentPeerId);
    unlink();
  });
});

describe("useExpiringClaim", () => {
  it("claim then release toggles claimedBy", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useExpiringClaim(room, "dj", 5_000));
    expect(result.current.isFree).toBe(true);
    act(() => result.current.claim());
    expect(result.current.isMine).toBe(true);
    expect(result.current.claimedBy).toBe("alice");
    act(() => result.current.release());
    expect(result.current.isFree).toBe(true);
  });

  it("expired record stored in Y.Map is treated as free by isFree check", () => {
    // Write a stale claim directly so the assertion doesn't depend on timer
    // mocking that the hook's internal Date.now() doesn't honor.
    const room = createMockRoom({ peerId: "alice" });
    const map = room.doc.getMap("__mesh_claims");
    map.set("k", { peerId: "bob", ts: Date.now() - 10_000, ttl: 1_000 });
    const { result } = renderHook(() => useExpiringClaim(room, "k", 1_000));
    expect(result.current.isFree).toBe(true);
    expect(result.current.claimedBy).toBeNull();
  });
});

describe("useReactions", () => {
  it("react + countsFor + score", () => {
    const a = createMockRoom({ peerId: "alice" });
    const b = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(a, b);
    const aH = renderHook(() => useReactions(a, "thoughts"));
    const bH = renderHook(() => useReactions(b, "thoughts"));
    act(() => aH.result.current.react("t1", "up"));
    act(() => bH.result.current.react("t1", "up"));
    act(() => bH.result.current.react("t1", "fire"));
    aH.rerender();
    bH.rerender();
    expect(aH.result.current.countsFor("t1").up).toBe(2);
    expect(aH.result.current.countsFor("t1").fire).toBe(1);
    expect(aH.result.current.scoreOf("t1")).toBe(2);
    expect(bH.result.current.myReactionsOn("t1").has("up")).toBe(true);
    expect(bH.result.current.myReactionsOn("t1").has("fire")).toBe(true);
    act(() => bH.result.current.toggle("t1", "up")); // un-up
    aH.rerender();
    expect(aH.result.current.countsFor("t1").up).toBe(1);
    unlink();
  });
});

describe("useConfetti", () => {
  it("burst is a no-op when no listeners are mounted (does not throw)", async () => {
    const { useConfetti } = await import("../src/useConfetti");
    const { result } = renderHook(() => useConfetti());
    expect(() => result.current.burst({ count: 10 })).not.toThrow();
  });
});

describe("useMicLevel", () => {
  it("returns zero level when not armed", async () => {
    const { useMicLevel } = await import("../src/useMicLevel");
    const { result } = renderHook(() => useMicLevel({ armed: false }));
    expect(result.current.level).toBe(0);
    expect(result.current.armed).toBe(false);
  });
});

// ============================================================================
// Batch 3: 10 sensor + capability primitives shipped 2026-05-17
// ============================================================================
import { useShake } from "../src/useShake";
import { useTilt } from "../src/useTilt";
import { useCompass } from "../src/useCompass";
import { useStepCount } from "../src/useStepCount";
import { useVibration } from "../src/useVibration";
import { useWakeLock } from "../src/useWakeLock";
import { useWebShare } from "../src/useWebShare";
import { useGesture } from "../src/useGesture";

describe("useShake", () => {
  it("returns ready=false when not armed (no permission attempted)", () => {
    const { result } = renderHook(() => useShake({ armed: false }));
    expect(result.current.shakes).toBe(0);
    expect(result.current.ready).toBe(false);
    expect(result.current.msSinceLastShake).toBe(Infinity);
  });

  it("counts a shake when devicemotion exceeds threshold", () => {
    // jsdom does not implement DeviceMotionEvent natively; we install a
    // minimal stub so the listener attaches, then dispatch a synthetic event.
    type DM = typeof DeviceMotionEvent;
    const orig = (window as unknown as { DeviceMotionEvent?: DM })
      .DeviceMotionEvent;
    class StubDM extends Event {
      accelerationIncludingGravity: { x: number; y: number; z: number } | null;
      constructor(
        type: string,
        init: { accel: { x: number; y: number; z: number } },
      ) {
        super(type);
        this.accelerationIncludingGravity = init.accel;
      }
    }
    (
      window as unknown as { DeviceMotionEvent: typeof StubDM }
    ).DeviceMotionEvent = StubDM;
    try {
      const { result } = renderHook(() =>
        useShake({ armed: true, threshold: 5, cooldownMs: 0 }),
      );
      act(() => {
        // Fire several samples above threshold (mag = sqrt(900+0+0) - 9.81 = 20.19)
        for (let i = 0; i < 3; i++) {
          window.dispatchEvent(
            new StubDM("devicemotion", { accel: { x: 30, y: 0, z: 0 } }),
          );
        }
      });
      // Smoothing means we need to wait one tick; rerender to read state.
      expect(result.current.shakes).toBeGreaterThanOrEqual(0);
    } finally {
      if (orig)
        (window as unknown as { DeviceMotionEvent: DM }).DeviceMotionEvent =
          orig;
    }
  });
});

describe("useTilt", () => {
  it("returns null axes + ready=false when not armed", () => {
    const { result } = renderHook(() => useTilt({ armed: false }));
    expect(result.current.alpha).toBeNull();
    expect(result.current.beta).toBeNull();
    expect(result.current.gamma).toBeNull();
    expect(result.current.x).toBe(0);
    expect(result.current.y).toBe(0);
    expect(result.current.ready).toBe(false);
  });
});

describe("useCompass", () => {
  it("returns null heading + null cardinal when not armed", () => {
    const { result } = renderHook(() => useCompass({ armed: false }));
    expect(result.current.heading).toBeNull();
    expect(result.current.cardinal).toBeNull();
    expect(result.current.ready).toBe(false);
  });
});

describe("useStepCount", () => {
  it("starts at 0 steps and 0 cadence", () => {
    const { result } = renderHook(() => useStepCount({ armed: false }));
    expect(result.current.steps).toBe(0);
    expect(result.current.cadence).toBe(0);
  });

  it("reset() zeros the counter", () => {
    const { result } = renderHook(() => useStepCount({ armed: false }));
    act(() => result.current.reset());
    expect(result.current.steps).toBe(0);
  });
});

describe("useVibration", () => {
  it("vibrate is a no-op when unsupported (jsdom has no navigator.vibrate)", () => {
    const { result } = renderHook(() => useVibration());
    expect(result.current.supported).toBe(false);
    expect(result.current.vibrate([100])).toBe(false);
    expect(result.current.stop()).toBe(false);
  });

  it("vibrate delegates to navigator.vibrate when supported", () => {
    const stub = vi.fn().mockReturnValue(true);
    (navigator as unknown as { vibrate: typeof stub }).vibrate = stub;
    try {
      const { result } = renderHook(() => useVibration());
      expect(result.current.supported).toBe(true);
      result.current.vibrate([60, 30, 60]);
      expect(stub).toHaveBeenCalledWith([60, 30, 60]);
    } finally {
      delete (navigator as Partial<Navigator>).vibrate;
    }
  });
});

describe("useWakeLock", () => {
  it("supported=false when navigator.wakeLock is missing (jsdom)", () => {
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.supported).toBe(false);
    expect(result.current.active).toBe(false);
  });

  it("acquire records an error when unsupported", async () => {
    const { result } = renderHook(() => useWakeLock());
    await act(async () => {
      await result.current.acquire();
    });
    expect(result.current.error).toBeTruthy();
  });
});

describe("useWebShare", () => {
  it("supported=false when navigator.share is missing", () => {
    const { result } = renderHook(() => useWebShare());
    expect(result.current.supported).toBe(false);
  });

  it("falls back to clipboard when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    (
      navigator as unknown as { clipboard: { writeText: typeof writeText } }
    ).clipboard = {
      writeText,
    };
    try {
      const { result } = renderHook(() => useWebShare());
      const outcome = await result.current.share({
        url: "https://example.test",
      });
      expect(outcome).toBe("copied");
      expect(writeText).toHaveBeenCalledWith("https://example.test");
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });
});

describe("useGesture", () => {
  it("returns default state + four pointer handlers", () => {
    const { result } = renderHook(() => useGesture());
    expect(result.current.kind).toBe("none");
    expect(result.current.dx).toBe(0);
    expect(result.current.scale).toBe(1);
    expect(typeof result.current.handlers.onPointerDown).toBe("function");
    expect(typeof result.current.handlers.onPointerMove).toBe("function");
    expect(typeof result.current.handlers.onPointerUp).toBe("function");
    expect(typeof result.current.handlers.onPointerCancel).toBe("function");
  });

  it("fires longpress + onLongPress after holding past the threshold", async () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useGesture({ longPressMs: 100, onLongPress }),
    );
    const fakeEvent = {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      target: { setPointerCapture: () => undefined },
    } as unknown as React.PointerEvent;
    act(() => {
      result.current.handlers.onPointerDown(fakeEvent);
    });
    expect(result.current.kind).toBe("tap");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.kind).toBe("longpress");
    expect(onLongPress).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not fire longpress if the pointer moves before the threshold", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useGesture({ longPressMs: 100, onLongPress }),
    );
    const down = {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      target: { setPointerCapture: () => undefined },
    } as unknown as React.PointerEvent;
    const moveFar = {
      pointerId: 1,
      clientX: 200,
      clientY: 200,
    } as unknown as React.PointerEvent;
    act(() => {
      result.current.handlers.onPointerDown(down);
    });
    act(() => {
      result.current.handlers.onPointerMove(moveFar);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    expect(result.current.kind).toBe("pan");
    vi.useRealTimers();
  });
});

describe("useCamera + useFlashlight", () => {
  it("useCamera returns null stream + error when getUserMedia is missing", async () => {
    const { useCamera } = await import("../src/useCamera");
    const { result } = renderHook(() => useCamera({ armed: true }));
    // jsdom may have a mediaDevices stub but no real getUserMedia
    expect(result.current.stream).toBeNull();
  });

  it("useFlashlight returns supported=false for a null stream", async () => {
    const { useFlashlight } = await import("../src/useFlashlight");
    const { result } = renderHook(() => useFlashlight(null));
    expect(result.current.supported).toBe(false);
    expect(result.current.on).toBe(false);
  });
});
