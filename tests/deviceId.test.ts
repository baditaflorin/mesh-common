import { describe, expect, it, beforeEach, vi } from "vitest";
import { ensureDeviceId } from "../src/deviceId";

// Minimal localStorage shim for node-environment tests.
const memStore = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k: string, v: string) => memStore.set(k, v),
  removeItem: (k: string) => memStore.delete(k),
  clear: () => memStore.clear(),
  key: (i: number) => Array.from(memStore.keys())[i] ?? null,
  get length() {
    return memStore.size;
  },
});

describe("ensureDeviceId", () => {
  beforeEach(() => memStore.clear());

  it("creates and persists a device id on first call", () => {
    const id = ensureDeviceId("test-app");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ensureDeviceId("test-app")).toBe(id);
  });

  it("scopes the device id per storagePrefix", () => {
    const a = ensureDeviceId("app-a");
    const b = ensureDeviceId("app-b");
    expect(a).not.toBe(b);
  });

  it("survives repeated calls without regenerating", () => {
    const first = ensureDeviceId("stable-app");
    for (let i = 0; i < 5; i++) {
      expect(ensureDeviceId("stable-app")).toBe(first);
    }
  });
});
