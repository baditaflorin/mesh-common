// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHapticPattern } from "../src/useHapticPattern";
import { useIdleDetector } from "../src/useIdleDetector";
import { useRoomLifecycle } from "../src/useRoomLifecycle";
import { createMockRoom } from "../testing/createMockRoom";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("fifth primitive wave", () => {
  it("tracks provider lifecycle and reconnects when the provider supports it", () => {
    const listeners = new Set<(event: { status?: string }) => void>();
    const connect = vi.fn();
    const disconnect = vi.fn();
    const room = createMockRoom({ peerId: "alice" });
    const roomWithProvider = {
      ...room,
      provider: {
        connected: false,
        connect,
        disconnect,
        on: (_: string, callback: (event: { status?: string }) => void) =>
          listeners.add(callback),
        off: (_: string, callback: (event: { status?: string }) => void) =>
          listeners.delete(callback),
      },
    };
    const { result } = renderHook(() => useRoomLifecycle(roomWithProvider));
    expect(result.current.status).toBe("joining");
    act(() =>
      listeners.forEach((listener) => listener({ status: "connected" })),
    );
    expect(result.current.status).toBe("connected");
    act(() => expect(result.current.reconnect()).toBe(true));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledOnce();
  });

  it("clears a failed reconnect error when the provider later recovers", () => {
    const listeners = new Set<(event: { status?: string }) => void>();
    const room = createMockRoom({ peerId: "alice" });
    const roomWithProvider = {
      ...room,
      provider: {
        connected: false,
        connect: () => {
          throw new Error("temporary signaling failure");
        },
        disconnect: vi.fn(),
        on: (_: string, callback: (event: { status?: string }) => void) =>
          listeners.add(callback),
        off: (_: string, callback: (event: { status?: string }) => void) =>
          listeners.delete(callback),
      },
    };
    const { result } = renderHook(() => useRoomLifecycle(roomWithProvider));
    act(() => expect(result.current.reconnect()).toBe(false));
    expect(result.current.error?.message).toContain(
      "temporary signaling failure",
    );
    act(() =>
      listeners.forEach((listener) => listener({ status: "connected" })),
    );
    expect(result.current).toMatchObject({ status: "connected", error: null });
  });

  it("honors haptic preference and provides a local idle timer", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    const haptic = renderHook(() => useHapticPattern("test:haptics"));
    act(() => expect(haptic.result.current.vibrate([10, 5, 10])).toBe(true));
    act(() => haptic.result.current.setEnabled(false));
    expect(haptic.result.current.vibrate()).toBe(false);
    expect(vibrate).toHaveBeenLastCalledWith(0);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const idle = renderHook(() => useIdleDetector({ timeoutMs: 100 }));
    act(() => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.150Z"));
      vi.advanceTimersByTime(250);
    });
    expect(idle.result.current.idle).toBe(true);
    act(() => idle.result.current.reset());
    expect(idle.result.current.idle).toBe(false);
  });
});
