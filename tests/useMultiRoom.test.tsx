// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as Y from "yjs";

// Stub createRoomSync to avoid spinning up real WebrtcProviders in tests.
vi.mock("../src/yjsRoom", () => {
  let n = 0;
  return {
    createRoomSync: (_prefix: string, roomId: string) => ({
      doc: new Y.Doc(),
      provider: null,
      signalingUrl: "ws://test",
      peerId: `peer-${++n}-${roomId}`,
    }),
  };
});
vi.mock("../src/iceConfig", async () => {
  const actual = await vi.importActual<typeof import("../src/iceConfig")>("../src/iceConfig");
  return {
    ...actual,
    iceStorage: () => ({} as ReturnType<typeof actual.iceStorage>),
    maybeFetchTurnCredentials: async () => undefined,
    loadIceServers: () => [],
    loadSignalingUrl: () => "ws://test",
  };
});

import { useMultiRoom } from "../src/useMultiRoom";
import type { MeshConfig } from "../src/MeshConfig";

const config = {
  appName: "test",
  storagePrefix: "test",
  version: "0.0.0",
  commit: "abc",
  accent: "#000",
  signalingUrl: "ws://test",
  turnTokenUrl: "https://test/turn",
} as unknown as MeshConfig;

beforeEach(() => {
  const memStore = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => memStore.set(k, v),
    removeItem: (k: string) => memStore.delete(k),
    clear: () => memStore.clear(),
    key: (i: number) => Array.from(memStore.keys())[i] ?? null,
    get length() {
      return memStore.size;
    },
  });
});

describe("useMultiRoom", () => {
  it("boots the initial rooms", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["alpha", "beta"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.rooms.map((r) => r.roomId)).toEqual(["alpha", "beta"]);
    expect(result.current.activeId).toBe("alpha");
    expect(result.current.active?.roomId).toBe("alpha");
  });

  it("setActive switches the active room", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["alpha", "beta"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    act(() => result.current.setActive("beta"));
    expect(result.current.activeId).toBe("beta");
    expect(result.current.active?.roomId).toBe("beta");
  });

  it("add creates a new room without dropping existing ones", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["alpha"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    act(() => result.current.add("gamma"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.rooms.map((r) => r.roomId).sort()).toEqual(["alpha", "gamma"]);
  });

  it("setActive(new) adds + activates", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["alpha"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    act(() => result.current.setActive("delta"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.activeId).toBe("delta");
    expect(result.current.rooms.map((r) => r.roomId)).toContain("delta");
  });

  it("remove drops the room and clears active if it was the active one", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["alpha", "beta"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    act(() => result.current.remove("alpha"));
    expect(result.current.rooms.map((r) => r.roomId)).toEqual(["beta"]);
    expect(result.current.activeId).toBeNull();
  });

  it("dedupes initial roomIds", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["a", "b", "a"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.rooms.map((r) => r.roomId)).toEqual(["a", "b"]);
  });
});
