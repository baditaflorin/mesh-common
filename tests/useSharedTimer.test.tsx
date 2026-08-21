// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import { useSharedTimer } from "../src/useSharedTimer";

describe("useSharedTimer", () => {
  afterEach(() => vi.useRealTimers());

  it("derives countdown progress from timestamps without writing every tick", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000));
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() =>
      useSharedTimer(room, "timer", { durationMs: 1_000, tickMs: 50 }),
    );

    act(() => expect(result.current.start()).toBe(true));
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.state).toBe("running");
    expect(result.current.elapsedMs).toBe(250);
    expect(result.current.remainingMs).toBe(750);

    act(() => vi.advanceTimersByTime(800));
    expect(result.current.state).toBe("finished");
    expect(result.current.elapsedMs).toBe(1_000);
    expect(result.current.remainingMs).toBe(0);
  });

  it("pauses, resumes and resets a stopwatch", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000));
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useSharedTimer(room, "timer", { tickMs: 50 }));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(200));
    act(() => expect(result.current.pause()).toBe(true));
    expect(result.current.elapsedMs).toBe(200);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.elapsedMs).toBe(200);
    act(() => expect(result.current.resume()).toBe(true));
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.elapsedMs).toBe(500);
    act(() => expect(result.current.reset()).toBe(true));
    expect(result.current).toMatchObject({ state: "idle", elapsedMs: 0, remainingMs: null });
  });

  it("shares lifecycle state while every peer derives time locally", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(10_000));
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedTimer(alice, "timer", { durationMs: 500, tickMs: 50 }));
    const b = renderHook(() => useSharedTimer(bob, "timer", { durationMs: 500, tickMs: 50 }));

    act(() => a.result.current.start());
    act(() => vi.advanceTimersByTime(200));
    expect(b.result.current).toMatchObject({ state: "running", elapsedMs: 200, remainingMs: 300 });
    act(() => b.result.current.pause());
    expect(a.result.current.state).toBe("paused");
    unlink();
  });

  it("is read-only inert without a room", () => {
    const { result } = renderHook(() => useSharedTimer(null, "timer", { durationMs: 100 }));
    expect(result.current).toMatchObject({ state: "idle", elapsedMs: 0, remainingMs: 100 });
    expect(result.current.start()).toBe(false);
  });
});
