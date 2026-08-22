// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFileDownload } from "../src/useFileDownload";
import { useGamepad } from "../src/useGamepad";
import { useLocalGeolocation } from "../src/useLocalGeolocation";

describe("tenth primitive wave", () => {
  it("exports local text through a download link", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const { result } = renderHook(() => useFileDownload());
    act(() => expect(result.current.downloadText("notes.txt", "hello")).toBe(true));
    expect(create).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce();
  });
  it("does not request local location on mount", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    renderHook(() => useLocalGeolocation());
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
  it("keeps gamepad state local when no controller is connected", () => {
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [] });
    const { result } = renderHook(() => useGamepad());
    expect(result.current.connected).toBe(false);
  });
});
