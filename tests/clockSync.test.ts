import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebrtcProvider } from "y-webrtc";
import { createClockSync } from "../src/clockSync";

/**
 * Tests against a hand-rolled fake awareness so the clock-sync algorithm
 * can be verified without spinning up a real WebRTC mesh.
 */

type Handler = () => void;

function makeFakeProvider(myId = 1) {
  const states = new Map<number, Record<string, unknown>>();
  const handlers = new Set<Handler>();

  const awareness = {
    clientID: myId,
    setLocalStateField(key: string, value: unknown) {
      const cur = states.get(myId) ?? {};
      states.set(myId, { ...cur, [key]: value });
      handlers.forEach((h) => h());
    },
    getStates() {
      return states;
    },
    on(_event: string, cb: Handler) {
      handlers.add(cb);
    },
    off(_event: string, cb: Handler) {
      handlers.delete(cb);
    },
  };

  return {
    provider: { awareness } as unknown as WebrtcProvider,
    injectPeer(id: number, t: number) {
      states.set(id, { clock: { t } });
      handlers.forEach((h) => h());
    },
    dropPeer(id: number) {
      states.delete(id);
      handlers.forEach((h) => h());
    },
    handlerCount: () => handlers.size,
  };
}

let realNow: number;

beforeEach(() => {
  vi.useFakeTimers();
  realNow = 1_700_000_000_000; // arbitrary stable epoch
  vi.setSystemTime(realNow);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createClockSync with null provider", () => {
  it("returns identity behavior", () => {
    const sync = createClockSync(null);
    expect(sync.peerCount()).toBe(0);
    expect(sync.meshNow()).toBe(realNow);
    sync.destroy();
  });
});

describe("createClockSync with no peers", () => {
  it("meshNow equals local Date.now()", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    expect(sync.meshNow()).toBe(realNow);
    expect(sync.peerCount()).toBe(0);
    sync.destroy();
  });
});

// The median always includes this peer's own clock (offset 0).
describe.each([
  ["single peer +250 ms ahead → median of 0, +250", [+250], +125],
  ["single peer -250 ms behind → median of -250, 0", [-250], -125],
  ["two peers, +100 and +200 → median of 0, +100, +200", [+100, +200], +100],
  ["three peers, +0 +100 +200 → median of 0, 0, +100, +200", [+0, +100, +200], +50],
  ["outlier resistance: -1000 -100 -50 0 +50 → median ≈ -25", [-1000, -100, -50, 0, +50], -25],
  ["all equal +500 → +500", [+500, +500, +500], +500],
])("meshNow offset matrix: %s", (_label, offsets, expectedMedian) => {
  it(`computes meshNow ≈ Date.now() + ${expectedMedian}`, () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    offsets.forEach((off, i) => fake.injectPeer(100 + i, realNow + off));
    expect(sync.meshNow()).toBe(realNow + expectedMedian);
    sync.destroy();
  });
});

describe("peer eviction", () => {
  it("removes a sample when its peer leaves awareness", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    fake.injectPeer(100, realNow + 500);
    fake.injectPeer(101, realNow + 1000);
    expect(sync.peerCount()).toBe(2);
    fake.dropPeer(100);
    expect(sync.peerCount()).toBe(1);
    sync.destroy();
  });

  it("ignores the local clientID's clock entry", () => {
    const fake = makeFakeProvider(7);
    const sync = createClockSync(fake.provider);
    // Local publish happens automatically; the local state should not be
    // counted as a peer sample.
    expect(sync.peerCount()).toBe(0);
    sync.destroy();
  });
});

describe("sample TTL (5 s)", () => {
  it("stops counting a peer after 5 s of silence", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    fake.injectPeer(100, realNow + 200);
    expect(sync.meshNow()).toBe(realNow + 100); // median of self (0) and +200

    vi.setSystemTime(realNow + 6_000);
    // Sample has expired; meshNow falls back to local time.
    expect(sync.meshNow()).toBe(realNow + 6_000);
    sync.destroy();
  });

  it("expires a silent peer even while our own publishes keep changing awareness", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    fake.injectPeer(100, realNow + 200);
    // Four of our own 1.5 s publishes fire awareness changes; the peer stays silent.
    vi.advanceTimersByTime(6_000);
    expect(sync.meshNow()).toBe(Date.now());
    sync.destroy();
  });
});

describe("stale timestamps", () => {
  it("keeps the offset stable across 10 publish cycles", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    fake.injectPeer(100, realNow + 250);
    for (let cycle = 0; cycle < 10; cycle++) {
      // Our own publish fires first; the peer's last `t` is now 1.5 s old.
      vi.advanceTimersByTime(1500);
      expect(Math.abs(sync.meshNow() - Date.now() - 125)).toBeLessThanOrEqual(5);
      fake.injectPeer(100, Date.now() + 250);
      expect(Math.abs(sync.meshNow() - Date.now() - 125)).toBeLessThanOrEqual(5);
    }
    sync.destroy();
  });
});

describe("agreement", () => {
  it("two peers 250 ms apart compute the same mesh time", () => {
    // Peer A's clock reads realNow; peer B's reads realNow + 250 at the same instant.
    const a = makeFakeProvider(1);
    const syncA = createClockSync(a.provider);
    a.injectPeer(2, realNow + 250);
    const meshA = syncA.meshNow();

    vi.setSystemTime(realNow + 250);
    const b = makeFakeProvider(2);
    const syncB = createClockSync(b.provider);
    b.injectPeer(1, realNow);
    const meshB = syncB.meshNow();

    expect(meshA).toBe(meshB);
    syncA.destroy();
    syncB.destroy();
  });
});

describe("hostile or broken clocks", () => {
  it("ignores a peer more than 10 minutes off", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    fake.injectPeer(100, realNow + 60 * 60_000);
    expect(sync.meshNow()).toBe(realNow);
    expect(sync.peerCount()).toBe(0);
    sync.destroy();
  });

  it("ignores a non-finite timestamp", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    fake.injectPeer(100, Number.POSITIVE_INFINITY);
    expect(sync.meshNow()).toBe(realNow);
    sync.destroy();
  });
});

describe("destroy", () => {
  it("clears the ping interval and unsubscribes the awareness handler", () => {
    const fake = makeFakeProvider();
    const sync = createClockSync(fake.provider);
    expect(fake.handlerCount()).toBe(1);
    sync.destroy();
    expect(fake.handlerCount()).toBe(0);
  });
});
