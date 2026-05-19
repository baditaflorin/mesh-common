// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChangelogToast } from "../src/useChangelogToast";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useChangelogToast", () => {
  it("first install is silent (skipFirstInstall default)", () => {
    const onUpgrade = vi.fn();
    renderHook(() => useChangelogToast({ appName: "test", version: "0.6.0", onUpgrade }));
    expect(onUpgrade).not.toHaveBeenCalled();
    expect(localStorage.getItem("mesh-changelog-toast:test")).toBe("0.6.0");
  });

  it("fires onUpgrade once when stored version differs", () => {
    localStorage.setItem("mesh-changelog-toast:test", "0.5.0");
    const onUpgrade = vi.fn();
    renderHook(() => useChangelogToast({ appName: "test", version: "0.6.0", onUpgrade }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onUpgrade).toHaveBeenCalledWith("0.5.0", "0.6.0");
    expect(localStorage.getItem("mesh-changelog-toast:test")).toBe("0.6.0");
  });

  it("does not fire when version is unchanged", () => {
    localStorage.setItem("mesh-changelog-toast:test", "0.6.0");
    const onUpgrade = vi.fn();
    renderHook(() => useChangelogToast({ appName: "test", version: "0.6.0", onUpgrade }));
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("skipFirstInstall=false fires for the very first install", () => {
    const onUpgrade = vi.fn();
    renderHook(() =>
      useChangelogToast({ appName: "test", version: "0.6.0", onUpgrade, skipFirstInstall: false }),
    );
    expect(onUpgrade).toHaveBeenCalledWith("", "0.6.0");
  });

  it("namespaces by appName", () => {
    localStorage.setItem("mesh-changelog-toast:foo", "0.5.0");
    const onUpgrade = vi.fn();
    renderHook(() => useChangelogToast({ appName: "bar", version: "0.6.0", onUpgrade }));
    // bar hasn't been seen → first install → silent
    expect(onUpgrade).not.toHaveBeenCalled();
    expect(localStorage.getItem("mesh-changelog-toast:foo")).toBe("0.5.0");
    expect(localStorage.getItem("mesh-changelog-toast:bar")).toBe("0.6.0");
  });
});
