// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBeforeUnload } from "../src/useBeforeUnload";
import { useFullscreen } from "../src/useFullscreen";
import { useInstallPrompt } from "../src/useInstallPrompt";
import { useNotification } from "../src/useNotification";
import { usePageVisibility } from "../src/usePageVisibility";

describe("ninth primitive wave", () => {
  it("only enters fullscreen through an explicit action", async () => {
    const request = vi.fn(async () => undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: request });
    const { result } = renderHook(() => useFullscreen());
    await act(async () => expect(await result.current.enter()).toBe(true));
    expect(request).toHaveBeenCalledOnce();
  });

  it("reports local visibility and focus changes", () => {
    const { result } = renderHook(() => usePageVisibility());
    act(() => window.dispatchEvent(new Event("blur")));
    expect(result.current.focused).toBe(false);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.focused).toBe(true);
  });

  it("captures an install event but does not open its prompt", async () => {
    const prompt = vi.fn(async () => undefined);
    const event = new Event("beforeinstallprompt") as Event & { prompt: typeof prompt; userChoice: Promise<{ outcome: "accepted" }> };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    const { result } = renderHook(() => useInstallPrompt());
    act(() => window.dispatchEvent(event));
    expect(result.current.available).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await act(async () => expect(await result.current.prompt()).toBe(true));
  });

  it("only requests notification access after an explicit call", async () => {
    const original = globalThis.Notification;
    const requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    class FakeNotification { static permission: NotificationPermission = "default"; static requestPermission = requestPermission; constructor(_title: string) {} }
    Object.defineProperty(globalThis, "Notification", { configurable: true, value: FakeNotification });
    try {
      const { result } = renderHook(() => useNotification());
      expect(requestPermission).not.toHaveBeenCalled();
      await act(async () => expect(await result.current.request()).toBe(true));
      expect(requestPermission).toHaveBeenCalledOnce();
    } finally { Object.defineProperty(globalThis, "Notification", { configurable: true, value: original }); }
  });

  it("attaches unload protection only when local work is dirty", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(({ dirty }) => useBeforeUnload(dirty), { initialProps: { dirty: false } });
    expect(add).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    rerender({ dirty: true });
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});

afterEach(() => vi.restoreAllMocks());
