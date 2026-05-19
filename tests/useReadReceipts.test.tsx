// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";
import { useReadReceipts } from "../src/useReadReceipts";

function room(peerId: string, doc: Y.Doc = new Y.Doc()): YRoom {
  return { doc, provider: null, peerId, peerCount: 0, roomId: "test" };
}

describe("useReadReceipts", () => {
  it("starts with mine=0 and empty receipts", () => {
    const r = room("alice");
    const { result } = renderHook(() => useReadReceipts(r));
    expect(result.current.mine).toBe(0);
    expect(result.current.receipts).toEqual({});
  });

  it("markSeen monotonically advances mine", () => {
    const r = room("alice");
    const { result } = renderHook(() => useReadReceipts(r));
    act(() => result.current.markSeen(3));
    expect(result.current.mine).toBe(3);
    act(() => result.current.markSeen(1));
    expect(result.current.mine).toBe(3); // monotone — backward write ignored
    act(() => result.current.markSeen(5));
    expect(result.current.mine).toBe(5);
  });

  it("shows other peers' receipts but excludes self", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<number>("mesh:receipts");
    map.set("bob", 7);
    map.set("carol", 2);
    map.set("alice", 99); // alice is self

    const r = room("alice", doc);
    const { result } = renderHook(() => useReadReceipts(r));
    expect(result.current.receipts).toEqual({ bob: 7, carol: 2 });
    expect(result.current.mine).toBe(99);
  });

  it("readersOf returns peers >= the given index", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<number>("mesh:receipts");
    map.set("bob", 5);
    map.set("carol", 3);
    map.set("dave", 10);

    const r = room("alice", doc);
    const { result } = renderHook(() => useReadReceipts(r));
    expect(result.current.readersOf(4).sort()).toEqual(["bob", "dave"]);
    expect(result.current.readersOf(10)).toEqual(["dave"]);
    expect(result.current.readersOf(100)).toEqual([]);
  });

  it("returns empty state when room is null", () => {
    const { result } = renderHook(() => useReadReceipts(null));
    expect(result.current.mine).toBe(0);
    expect(result.current.receipts).toEqual({});
    expect(result.current.readersOf(1)).toEqual([]);
  });
});

// Note: tests must NOT call `room("alice")` inline inside `renderHook(() => …)`
// because the helper creates a fresh Y.Doc on each render — that destabilizes
// the hook's effect deps and causes an infinite render loop. Always bind a
// stable `room` first, then pass it into the hook.
