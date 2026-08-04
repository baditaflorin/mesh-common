// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";
import { useRoster } from "../src/useRoster";

function room(overrides: Partial<YRoom> & { peerId: string }, doc: Y.Doc = new Y.Doc()): YRoom {
  return { doc, provider: null, peerCount: 0, roomId: "test", ...overrides };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useRoster", () => {
  it("reports a single peer as present after its first heartbeat", () => {
    const r = room({ peerId: "alice", deviceId: "dev-alice" });
    const { result } = renderHook(() => useRoster(r));
    expect(result.current.present).toEqual(["alice"]);
    expect(result.current.total).toBe(1);
  });

  it("moves a peer to absent once its heartbeat goes stale", () => {
    const r = room({ peerId: "alice", deviceId: "dev-alice" });
    const { result } = renderHook(() => useRoster(r, { freshnessMs: 1000 }));
    expect(result.current.present).toEqual(["alice"]);
    // The "now" ticker runs every min(heartbeatMs, 2000)ms, so advance past
    // both that and freshnessMs to let the next tick observe the staleness.
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.present).toEqual([]);
    expect(result.current.absent).toEqual(["alice"]);
  });

  it("dedupes a refresh's old + new peerId sharing one deviceId (the double-count bug)", () => {
    const doc = new Y.Doc();
    // Simulate the old, pre-refresh session's heartbeat that already landed
    // in the doc, and would otherwise still be "fresh" for a few seconds.
    doc.getMap<number>("__mesh_roster").set("old-peer-id", Date.now());
    doc.getMap<string>("__mesh_roster_device").set("old-peer-id", "dev-alice");

    // A second, independent peer with a different device — must stay distinct.
    doc.getMap<number>("__mesh_roster").set("bob-peer-id", Date.now());
    doc.getMap<string>("__mesh_roster_device").set("bob-peer-id", "dev-bob");

    const r = room({ peerId: "new-peer-id", deviceId: "dev-alice" }, doc);
    const { result } = renderHook(() => useRoster(r));

    // Without dedup this would be ["bob-peer-id", "new-peer-id", "old-peer-id"].
    expect(result.current.present.sort()).toEqual(["bob-peer-id", "new-peer-id"]);
    expect(result.current.total).toBe(2);
    expect(result.current.isPresent("old-peer-id")).toBe(false);
  });

  it("garbage-collects the stale peerId from a prior session of the same device", () => {
    const doc = new Y.Doc();
    doc.getMap<number>("__mesh_roster").set("old-peer-id", Date.now());
    doc.getMap<string>("__mesh_roster_device").set("old-peer-id", "dev-alice");

    const r = room({ peerId: "new-peer-id", deviceId: "dev-alice" }, doc);
    renderHook(() => useRoster(r));

    expect(doc.getMap("__mesh_roster").has("old-peer-id")).toBe(false);
    expect(doc.getMap("__mesh_roster_device").has("old-peer-id")).toBe(false);
    expect(doc.getMap("__mesh_roster").has("new-peer-id")).toBe(true);
  });

  it("does not GC or collapse a peerId belonging to a different device", () => {
    const doc = new Y.Doc();
    doc.getMap<number>("__mesh_roster").set("bob-peer-id", Date.now());
    doc.getMap<string>("__mesh_roster_device").set("bob-peer-id", "dev-bob");

    const r = room({ peerId: "alice-peer-id", deviceId: "dev-alice" }, doc);
    const { result } = renderHook(() => useRoster(r));

    expect(doc.getMap("__mesh_roster").has("bob-peer-id")).toBe(true);
    expect(result.current.present.sort()).toEqual(["alice-peer-id", "bob-peer-id"]);
  });

  it("falls back to no dedup when deviceId is unavailable (older peers / mocks)", () => {
    const doc = new Y.Doc();
    doc.getMap<number>("__mesh_roster").set("old-peer-id", Date.now());
    // No entry in __mesh_roster_device for old-peer-id — unknown device.

    const r = room({ peerId: "new-peer-id" }, doc); // no deviceId
    const { result } = renderHook(() => useRoster(r));

    expect(result.current.present.sort()).toEqual(["new-peer-id", "old-peer-id"]);
    expect(result.current.total).toBe(2);
  });
});
