// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";
import { useSharedStrokes } from "../src/useSharedStrokes";

function room(peerId: string, doc: Y.Doc): YRoom {
  return { doc, provider: null, peerId, peerCount: 0, roomId: "test" };
}

describe("useSharedStrokes", () => {
  it("commits a finished stroke and tags it with the local peerId", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() =>
      useSharedStrokes(room("alice", doc), { color: "#f00", width: 4 }),
    );
    act(() => result.current.add([0, 0, 10, 10]));
    expect(result.current.strokes).toHaveLength(1);
    expect(result.current.strokes[0]).toMatchObject({
      peerId: "alice",
      color: "#f00",
      width: 4,
      points: [0, 0, 10, 10],
    });
  });

  it("ignores empty, too-short, or odd-length point lists", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useSharedStrokes(room("alice", doc)));
    act(() => {
      result.current.add([]);
      result.current.add([1, 2]); // only one point
      result.current.add([1, 2, 3]); // odd length
    });
    expect(result.current.strokes).toHaveLength(0);
  });

  it("replicates a stroke drawn by one peer to another on the same doc", () => {
    const doc = new Y.Doc();
    const a = renderHook(() => useSharedStrokes(room("alice", doc)));
    const b = renderHook(() => useSharedStrokes(room("bob", doc)));
    act(() => a.result.current.add([0, 0, 5, 5], { color: "#00f" }));
    expect(b.result.current.strokes).toHaveLength(1);
    expect(b.result.current.strokes[0]).toMatchObject({
      peerId: "alice",
      color: "#00f",
    });
  });

  it("clear wipes everything; undoLast targets the right stroke", () => {
    const doc = new Y.Doc();
    const a = renderHook(() => useSharedStrokes(room("alice", doc)));
    const b = renderHook(() => useSharedStrokes(room("bob", doc)));
    act(() => {
      a.result.current.add([0, 0, 1, 1]); // alice #1
      b.result.current.add([1, 1, 2, 2]); // bob #1
      a.result.current.add([2, 2, 3, 3]); // alice #2
    });
    expect(a.result.current.strokes).toHaveLength(3);

    // undo alice's last only — bob's stroke survives in the middle
    act(() => a.result.current.undoLast("alice"));
    expect(a.result.current.strokes.map((s) => s.peerId)).toEqual([
      "alice",
      "bob",
    ]);

    // undo the global last (bob's)
    act(() => a.result.current.undoLast());
    expect(a.result.current.strokes.map((s) => s.peerId)).toEqual(["alice"]);

    act(() => a.result.current.clear());
    expect(a.result.current.strokes).toHaveLength(0);
  });

  it("replay draws each committed stroke onto a 2D context", () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useSharedStrokes(room("alice", doc)));
    act(() => result.current.add([0, 0, 10, 10, 20, 5], { width: 2 }));

    const calls: string[] = [];
    let cleared = false;
    const ctx = {
      canvas: { width: 100, height: 80 },
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
      clearRect: () => {
        cleared = true;
      },
      beginPath: () => calls.push("begin"),
      moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
      stroke: () => calls.push("stroke"),
    } as unknown as CanvasRenderingContext2D;

    act(() => result.current.replay(ctx, { clear: true }));
    expect(cleared).toBe(true);
    expect(calls).toEqual([
      "begin",
      "move 0,0",
      "line 10,10",
      "line 20,5",
      "stroke",
    ]);
    expect(ctx.lineWidth).toBe(2);
  });
});
