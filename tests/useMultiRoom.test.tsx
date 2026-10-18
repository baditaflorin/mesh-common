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
    const alphaBefore = result.current.active!;
    let alphaDestroyed = false;
    alphaBefore.doc.on("destroy", () => {
      alphaDestroyed = true;
    });
    alphaBefore.doc.getMap("notes").set("n1", "kept");
    act(() => result.current.add("gamma"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.rooms.map((r) => r.roomId).sort()).toEqual(["alpha", "gamma"]);
    // Same live doc and peer, with its data — not a fresh, empty replacement.
    const alphaAfter = result.current.rooms.find((r) => r.roomId === "alpha")!.room!;
    expect(alphaDestroyed).toBe(false);
    expect(alphaAfter.doc).toBe(alphaBefore.doc);
    expect(alphaAfter.peerId).toBe(alphaBefore.peerId);
    expect(alphaAfter.doc.getMap("notes").get("n1")).toBe("kept");
  });

  it("remove tears down only the removed room", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["alpha", "beta"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const alpha = result.current.rooms.find((r) => r.roomId === "alpha")!.room!;
    const beta = result.current.rooms.find((r) => r.roomId === "beta")!.room!;
    const destroyed: string[] = [];
    alpha.doc.on("destroy", () => destroyed.push("alpha"));
    beta.doc.on("destroy", () => destroyed.push("beta"));
    act(() => result.current.remove("alpha"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(destroyed).toEqual(["alpha"]);
    expect(result.current.rooms[0]!.room!.doc).toBe(beta.doc);
  });

  it("unmount tears down every room", async () => {
    const { result, unmount } = renderHook(() => useMultiRoom(config, ["alpha", "beta"]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const destroyed: string[] = [];
    for (const r of result.current.rooms) r.room!.doc.on("destroy", () => destroyed.push(r.roomId));
    unmount();
    expect(destroyed.sort()).toEqual(["alpha", "beta"]);
  });

  it("a room removed while booting is not resurrected", async () => {
    const { result } = renderHook(() => useMultiRoom(config, ["alpha"]));
    act(() => {
      result.current.add("gamma");
    });
    act(() => result.current.remove("gamma"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.rooms.map((r) => r.roomId)).toEqual(["alpha"]);
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
