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

describe.each([
  ["single peer +250 ms ahead", [+250], +250],
  ["single peer -250 ms behind", [-250], -250],
  ["two peers, +100 and +200 → median 150", [+100, +200], +150],
  ["three peers, +0 +100 +200 → median 100", [+0, +100, +200], +100],
  ["outlier resistance: -1000 -100 -50 0 +50 → median ≈ -50", [-1000, -100, -50, 0, +50], -50],
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
    expect(sync.meshNow()).toBe(realNow + 200);

    vi.setSystemTime(realNow + 6_000);
    // Sample has expired; meshNow falls back to local time.
    expect(sync.meshNow()).toBe(realNow + 6_000);
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
