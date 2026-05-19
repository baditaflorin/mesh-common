// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOfflineQueue } from "../src/useOfflineQueue";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useOfflineQueue", () => {
  it("buffers writes when offline and exposes size + pending", () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOfflineQueue<{ body: string }>({
        online: false,
        flush,
        storageKey: "test:queue",
      }),
    );
    act(() => {
      result.current.enqueue({ id: "1", payload: { body: "hi" } });
      result.current.enqueue({ id: "2", payload: { body: "there" } });
    });
    expect(result.current.size).toBe(2);
    expect(result.current.pending.map((p) => p.id)).toEqual(["1", "2"]);
    expect(flush).not.toHaveBeenCalled();
  });

  it("dedupes by id (idempotent enqueue)", () => {
    const { result } = renderHook(() =>
      useOfflineQueue<{ body: string }>({
        online: false,
        flush: vi.fn().mockResolvedValue(undefined),
        storageKey: "test:queue",
      }),
    );
    act(() => {
      result.current.enqueue({ id: "x", payload: { body: "first" } });
      result.current.enqueue({ id: "x", payload: { body: "dup" } });
    });
    expect(result.current.size).toBe(1);
    expect(result.current.pending[0]?.payload.body).toBe("first");
  });

  it("drains when online flips true", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ online }: { online: boolean }) =>
        useOfflineQueue<{ body: string }>({ online, flush, storageKey: "test:queue", retryMs: 5 }),
      { initialProps: { online: false } },
    );
    act(() => {
      result.current.enqueue({ id: "1", payload: { body: "hi" } });
      result.current.enqueue({ id: "2", payload: { body: "there" } });
    });
    expect(result.current.size).toBe(2);
    await act(async () => {
      rerender({ online: true });
      // give the drain a tick
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(flush).toHaveBeenCalledTimes(2);
    expect(result.current.size).toBe(0);
  });

  it("transient flush failures don't drop the item (attempts increments)", async () => {
    let calls = 0;
    const flush = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 2) throw new Error("transient");
    });
    const { result, rerender } = renderHook(
      ({ online }: { online: boolean }) =>
        useOfflineQueue<{ body: string }>({
          online,
          flush,
          storageKey: "test:queue",
          retryMs: 5,
        }),
      { initialProps: { online: true } },
    );
    await act(async () => {
      result.current.enqueue({ id: "1", payload: { body: "hi" } });
      await new Promise((r) => setTimeout(r, 30));
    });
    // After the first failure the item must still be in the queue with attempts >= 1.
    if (result.current.size > 0) {
      expect(result.current.pending[0]?.attempts).toBeGreaterThanOrEqual(1);
    }
    // Re-toggle online to kick a fresh drain; the second attempt succeeds.
    await act(async () => {
      rerender({ online: false });
      rerender({ online: true });
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(result.current.size).toBe(0);
  });

  it("persists queue across hook remounts via localStorage", () => {
    const r1 = renderHook(() =>
      useOfflineQueue<{ body: string }>({
        online: false,
        flush: vi.fn().mockResolvedValue(undefined),
        storageKey: "test:queue-persist",
      }),
    );
    act(() => r1.result.current.enqueue({ id: "1", payload: { body: "hi" } }));
    r1.unmount();

    const r2 = renderHook(() =>
      useOfflineQueue<{ body: string }>({
        online: false,
        flush: vi.fn().mockResolvedValue(undefined),
        storageKey: "test:queue-persist",
      }),
    );
    expect(r2.result.current.size).toBe(1);
    expect(r2.result.current.pending[0]?.id).toBe("1");
  });

  it("ack and clear empty the queue", () => {
    const { result } = renderHook(() =>
      useOfflineQueue<{ body: string }>({
        online: false,
        flush: vi.fn().mockResolvedValue(undefined),
        storageKey: "test:queue",
      }),
    );
    act(() => {
      result.current.enqueue({ id: "a", payload: { body: "x" } });
      result.current.enqueue({ id: "b", payload: { body: "y" } });
      result.current.ack("a");
    });
    expect(result.current.size).toBe(1);
    act(() => result.current.clear());
    expect(result.current.size).toBe(0);
  });
});
