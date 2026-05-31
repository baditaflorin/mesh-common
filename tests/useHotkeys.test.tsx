// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useHotkeys, type HotkeyMap } from "../src/useHotkeys";

function press(
  key: string,
  mods: Partial<KeyboardEventInit> = {},
  target?: EventTarget,
) {
  const ev = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...mods,
  });
  (target ?? window).dispatchEvent(ev);
  return ev;
}

describe("useHotkeys", () => {
  let hits: string[];
  beforeEach(() => {
    hits = [];
  });
  afterEach(() => {
    cleanup(); // unmount hooks so their window listeners detach between tests
    document.body.innerHTML = "";
  });

  it("fires on a bare key and normalizes space", () => {
    const map: HotkeyMap = { space: () => hits.push("space") };
    renderHook(() => useHotkeys(map));
    press(" ");
    expect(hits).toEqual(["space"]);
  });

  it("matches modifier combos regardless of declared order", () => {
    const map: HotkeyMap = { "shift+ctrl+a": () => hits.push("combo") };
    renderHook(() => useHotkeys(map));
    press("a", { ctrlKey: true, shiftKey: true });
    expect(hits).toEqual(["combo"]);
  });

  it("preventDefault is applied to a matched key by default", () => {
    renderHook(() => useHotkeys({ enter: () => hits.push("enter") }));
    const ev = press("Enter");
    expect(hits).toEqual(["enter"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ignores events from form fields unless ignoreInputs is false", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);

    const r1 = renderHook(() =>
      useHotkeys({ space: () => hits.push("typed") }),
    );
    press(" ", {}, input);
    expect(hits).toEqual([]); // swallowed: don't eat a typed space
    r1.unmount();

    renderHook(() =>
      useHotkeys({ space: () => hits.push("typed") }, { ignoreInputs: false }),
    );
    press(" ", {}, input);
    expect(hits).toEqual(["typed"]);
  });

  it("does nothing when disabled and detaches on unmount", () => {
    const off = renderHook(() =>
      useHotkeys({ space: () => hits.push("x") }, { enabled: false }),
    );
    press(" ");
    expect(hits).toEqual([]);
    off.unmount();

    const on = renderHook(() => useHotkeys({ space: () => hits.push("x") }));
    press(" ");
    expect(hits).toEqual(["x"]);
    on.unmount();
    press(" ");
    expect(hits).toEqual(["x"]); // no further hits after unmount
  });
});
