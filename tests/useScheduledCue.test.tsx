// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScheduledCue } from "../src/useScheduledCue";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

const isLightCue = (value: unknown): value is { mode: "screen" | "torch" } =>
  typeof value === "object" &&
  value !== null &&
  ((value as { mode?: unknown }).mode === "screen" ||
    (value as { mode?: unknown }).mode === "torch");

describe("useScheduledCue", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("replicates one timestamped cue and derives due time without per-tick writes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(10_000));
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() =>
      useScheduledCue(alice, "light", {
        minLeadMs: 500,
        tickMs: 25,
        isPayload: isLightCue,
      }),
    );
    const b = renderHook(() =>
      useScheduledCue(bob, "light", {
        minLeadMs: 500,
        tickMs: 25,
        isPayload: isLightCue,
      }),
    );

    act(() =>
      expect(a.result.current.scheduleIn({ mode: "screen" }, 1_000)).toBe(true),
    );
    expect(b.result.current).toMatchObject({
      state: "scheduled",
      cue: { payload: { mode: "screen" } },
      remainingMs: 1_000,
    });

    act(() => vi.advanceTimersByTime(1_025));
    expect(a.result.current).toMatchObject({
      state: "due",
      remainingMs: 0,
      latenessMs: 25,
    });
    expect(b.result.current.state).toBe("due");
    unlink();
  });

  it("bounds lead time, validates remote payloads, and expires stale cues", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(10_000));
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() =>
      useScheduledCue(room, "light", {
        minLeadMs: 500,
        maxLeadMs: 2_000,
        graceMs: 100,
        tickMs: 25,
        isPayload: isLightCue,
      }),
    );

    act(() =>
      expect(result.current.scheduleIn({ mode: "screen" }, 200)).toBe(false),
    );
    act(() =>
      expect(result.current.scheduleIn({ mode: "screen" }, 2_001)).toBe(false),
    );
    act(() =>
      expect(result.current.scheduleIn({ mode: "torch" }, 500)).toBe(true),
    );
    act(() => vi.advanceTimersByTime(650));
    expect(result.current).toMatchObject({ state: "expired", latenessMs: 150 });

    act(() =>
      room.doc.getMap<unknown>("light").set("current", {
        state: "scheduled",
        id: "bad",
        fireAt: 12_000,
        payload: { mode: "unsafe" },
      }),
    );
    expect(result.current).toMatchObject({ state: "idle", cue: null });
  });

  it("accepts an exact minimum delay even when a shared clock advances per read", () => {
    let tick = 10_000;
    const clock = {
      meshNow: () => tick++,
      destroy: () => undefined,
      peerCount: () => 0,
    };
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() =>
      useScheduledCue(room, "light", {
        clock,
        minLeadMs: 1_000,
        isPayload: isLightCue,
      }),
    );

    act(() =>
      expect(result.current.scheduleIn({ mode: "screen" }, 1_000)).toBe(true),
    );
    expect(result.current.cue?.fireAt).toBe(11_001);
  });

  it("replicates cancellation and never clears an actionable cue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(10_000));
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() =>
      useScheduledCue(alice, "light", {
        minLeadMs: 500,
        isPayload: isLightCue,
      }),
    );
    const b = renderHook(() =>
      useScheduledCue(bob, "light", { minLeadMs: 500, isPayload: isLightCue }),
    );

    act(() => a.result.current.scheduleIn({ mode: "screen" }, 1_000));
    expect(b.result.current.clear()).toBe(false);
    act(() => expect(b.result.current.cancel()).toBe(true));
    expect(a.result.current.state).toBe("cancelled");
    act(() => expect(a.result.current.clear()).toBe(true));
    expect(b.result.current.state).toBe("idle");
    unlink();
  });

  it("is inert without a room", () => {
    const { result } = renderHook(() =>
      useScheduledCue(null, "light", { isPayload: isLightCue }),
    );
    expect(result.current).toMatchObject({
      state: "idle",
      cue: null,
      remainingMs: null,
    });
    expect(result.current.scheduleIn({ mode: "screen" }, 1_000)).toBe(false);
  });
});
