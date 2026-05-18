// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness.js";
import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";
import { useAwareness } from "../src/useAwareness";

/**
 * useAwareness is intrinsically a network-coupled hook (it relies on the
 * provider's awareness instance). For unit tests we mount a real Awareness
 * onto a real Y.Doc and shape it like a provider so the hook can find it.
 */
function makeRoom(peerId: string): { room: YRoom; aw: Awareness } {
  const doc = new Y.Doc();
  const aw = new Awareness(doc);
  // Match the provider shape that getAwareness() in useAwareness.ts looks for.
  const fakeProvider = { awareness: aw } as unknown as YRoom["provider"];
  return {
    aw,
    room: {
      doc,
      provider: fakeProvider,
      peerId,
      peerCount: 0,
      roomId: "test",
    },
  };
}

describe("useAwareness", () => {
  it("returns null local + empty peers when room is null", () => {
    const { result } = renderHook(() => useAwareness(null));
    expect(result.current.local).toBeNull();
    expect(result.current.peers.size).toBe(0);
    expect(result.current.count).toBe(0);
  });

  it("setLocal broadcasts and round-trips through getLocalState", () => {
    const { room, aw } = makeRoom("alice");
    const { result } = renderHook(() => useAwareness<{ name: string }>(room));
    act(() => result.current.setLocal({ name: "alice" }));
    const local = aw.getLocalState() as { name?: string; __peerId?: string };
    expect(local.name).toBe("alice");
    expect(local.__peerId).toBe("alice");
  });

  it("two peers see each other after both setLocal", () => {
    const { room: roomA, aw: awA } = makeRoom("alice");
    const { room: roomB, aw: awB } = makeRoom("bob");

    // Pretend they share a network: pipe each peer's awareness updates into the other
    // using the official y-protocols wire format.
    const pipe = (from: Awareness, to: Awareness) => {
      from.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changed = [...added, ...updated, ...removed];
        if (changed.length === 0) return;
        applyAwarenessUpdate(to, encodeAwarenessUpdate(from, changed), "remote");
      });
    };
    pipe(awA, awB);
    pipe(awB, awA);

    const a = renderHook(() => useAwareness<{ name: string }>(roomA));
    const b = renderHook(() => useAwareness<{ name: string }>(roomB));

    act(() => a.result.current.setLocal({ name: "alice" }));
    b.rerender();

    expect(b.result.current.peers.get("alice")?.name).toBe("alice");
    expect(b.result.current.count).toBe(1);
  });

  it("setLocal(null) clears the broadcasted state but keeps __peerId", () => {
    const { room, aw } = makeRoom("alice");
    const { result } = renderHook(() => useAwareness<{ name: string }>(room));
    act(() => result.current.setLocal({ name: "alice" }));
    act(() => result.current.setLocal(null));
    const local = aw.getLocalState() as { name?: string; __peerId?: string };
    expect(local.name).toBeUndefined();
    expect(local.__peerId).toBe("alice");
  });
});
