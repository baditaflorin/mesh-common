// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { Awareness } from "y-protocols/awareness.js";
import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";
import { useNetworkQuality } from "../src/useNetworkQuality";

function awarenessRoom(): { room: YRoom; awareness: Awareness; doc: Y.Doc } {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  return {
    doc,
    awareness,
    room: {
      doc,
      provider: { awareness } as unknown as YRoom["provider"],
      peerId: "quality-local",
      peerCount: 0,
      roomId: "quality-room",
    },
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useNetworkQuality", () => {
  it("does not restart its ping interval after its own awareness update", () => {
    vi.useFakeTimers();
    const { room, awareness, doc } = awarenessRoom();
    const setLocalState = vi.spyOn(awareness, "setLocalState");
    const pingWrites = () =>
      setLocalState.mock.calls.filter(([state]) =>
        Boolean((state as { pingNonce?: string } | null)?.pingNonce),
      ).length;

    try {
      renderHook(() =>
        useNetworkQuality(room, {
          intervalMs: 100,
          idleIntervalMs: 100,
        }),
      );

      // The first ping updates awareness and causes useAwareness to rerender.
      // That rerender must not be treated as a changed effect dependency, or
      // every ping becomes an immediate new ping (React maximum-depth loop).
      expect(pingWrites()).toBe(1);
      act(() => vi.advanceTimersByTime(99));
      expect(pingWrites()).toBe(1);
      act(() => vi.advanceTimersByTime(1));
      expect(pingWrites()).toBe(2);
    } finally {
      doc.destroy();
    }
  });
});
