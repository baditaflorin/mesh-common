// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClipboard } from "../src/useClipboard";

const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;

function setClipboard(value: Clipboard | undefined): void {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

function setExecCommand(value: typeof document.execCommand | undefined): void {
  Object.defineProperty(document, "execCommand", { configurable: true, value });
}

afterEach(() => {
  setClipboard(originalClipboard);
  setExecCommand(originalExecCommand);
  vi.useRealTimers();
});

describe("useClipboard", () => {
  it("writes with the Clipboard API and exposes temporary copied feedback", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText } as unknown as Clipboard);
    setExecCommand(undefined);
    const { result } = renderHook(() => useClipboard({ copiedDurationMs: 100 }));

    await act(async () => expect(await result.current.write("room link")).toBe(true));
    expect(writeText).toHaveBeenCalledWith("room link");
    expect(result.current.supported).toBe(true);
    expect(result.current.copied).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.copied).toBe(false);
  });

  it("uses the transient textarea fallback when Clipboard API is unavailable", async () => {
    setClipboard(undefined);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);
    const { result } = renderHook(() => useClipboard());

    await act(async () => expect(await result.current.write("fallback")).toBe(true));
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    expect(result.current.copied).toBe(true);
  });

  it("reads text and records permission failures without throwing", async () => {
    const readText = vi.fn().mockResolvedValue("shared secret");
    setClipboard({ readText } as unknown as Clipboard);
    const { result, rerender } = renderHook(() => useClipboard());

    await act(async () => expect(await result.current.read()).toBe("shared secret"));
    expect(result.current.error).toBeNull();

    readText.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    rerender();
    await act(async () => expect(await result.current.read()).toBeNull());
    expect(result.current.error?.name).toBe("NotAllowedError");
  });

  it("returns a recoverable failure when copy support is absent", async () => {
    setClipboard(undefined);
    setExecCommand(undefined);
    const { result } = renderHook(() => useClipboard());

    await act(async () => expect(await result.current.write("nope")).toBe(false));
    expect(result.current.supported).toBe(false);
    expect(result.current.error?.message).toContain("not supported");
  });
});
