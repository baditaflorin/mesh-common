// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNetworkOnline } from "../src/useNetworkOnline";

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("useNetworkOnline", () => {
  it("starts with navigator.onLine", () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(() =>
      useNetworkOnline({ probeIntervalMs: 60_000, retryIntervalMs: 60_000 }),
    );
    expect(result.current.online).toBe(true);
  });

  it("flips false when navigator.onLine is false", () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(() =>
      useNetworkOnline({ probeIntervalMs: 60_000, retryIntervalMs: 60_000 }),
    );
    // initial state already reflects navigator
    expect(result.current.online).toBe(false);
  });

  it("flips false when probe rejects (probe-failed)", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("DNS"));
    const { result } = renderHook(() =>
      useNetworkOnline({
        probeIntervalMs: 60_000,
        retryIntervalMs: 60_000,
        probeUrl: "https://example.invalid/x",
      }),
    );
    await waitFor(() => {
      expect(result.current.online).toBe(false);
      expect(result.current.why).toBe("probe-failed");
    });
  });

  it("flips back true on successful probe", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(() =>
      useNetworkOnline({
        probeIntervalMs: 60_000,
        retryIntervalMs: 60_000,
        probeUrl: "https://example.test/canary",
      }),
    );
    await waitFor(() => {
      expect(result.current.online).toBe(true);
      expect(result.current.why).toBe("probe-ok");
    });
  });
});
