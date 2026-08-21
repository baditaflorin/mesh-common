// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import { useSharedQueue } from "../src/useSharedQueue";

describe("useSharedQueue", () => {
  it("processes entries FIFO and only lets the claiming peer acknowledge them", () => {
    let time = 1_000;
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useSharedQueue<string>(room, "work", { now: () => time }));

    act(() => {
      result.current.enqueue("first", { id: "a" });
      result.current.enqueue("second", { id: "b" });
    });
    expect(result.current.pending).toBe(2);
    let claim: ReturnType<typeof result.current.claimNext>;
    act(() => { claim = result.current.claimNext(); });
    expect(claim!).toMatchObject({ id: "a", payload: "first", claimedBy: "alice" });
    expect(result.current.pending).toBe(1);
    act(() => expect(result.current.acknowledge("a")).toBe(true));
    expect(result.current.entries.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("replicates claims and lets another peer reclaim an expired one", () => {
    let time = 1_000;
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedQueue<string>(alice, "work", { now: () => time, claimTtlMs: 100 }));
    const b = renderHook(() => useSharedQueue<string>(bob, "work", { now: () => time, claimTtlMs: 100 }));

    act(() => a.result.current.enqueue("shared", { id: "item" }));
    act(() => a.result.current.claimNext());
    expect(b.result.current.entries[0]).toMatchObject({ id: "item", claimedBy: "alice" });
    expect(b.result.current.claimNext()).toBeNull();

    time += 100;
    let recovered: ReturnType<typeof b.result.current.claimNext>;
    act(() => { recovered = b.result.current.claimNext(); });
    expect(recovered!).toMatchObject({ id: "item", claimedBy: "bob" });
    expect(a.result.current.entries[0]?.claimedBy).toBe("bob");
    act(() => expect(a.result.current.acknowledge("item")).toBe(false));
    unlink();
  });

  it("releases claims and supports host removal", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useSharedQueue<string>(room, "work"));
    act(() => result.current.enqueue("one", { id: "a" }));
    act(() => result.current.claimNext());
    act(() => expect(result.current.release("a")).toBe(true));
    expect(result.current.entries[0]).toMatchObject({ claimedBy: null, claimExpiresAt: null });
    act(() => expect(result.current.remove("a")).toBe(true));
    expect(result.current.entries).toEqual([]);
  });

  it("is inert without a room", () => {
    const { result } = renderHook(() => useSharedQueue<string>(null, "work"));
    expect(result.current.enqueue("x")).toBeNull();
    expect(result.current.claimNext()).toBeNull();
    expect(result.current.remove("x")).toBe(false);
  });
});
