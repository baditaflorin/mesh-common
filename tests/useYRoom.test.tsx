// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const awarenessListeners = new Set<() => void>();
  const peerListeners = new Set<() => void>();
  const states = new Map<unknown, unknown>();
  const provider = {
    awareness: {
      getStates: () => states,
      on: (_event: "change", listener: () => void) =>
        awarenessListeners.add(listener),
      off: (_event: "change", listener: () => void) =>
        awarenessListeners.delete(listener),
    },
    room: {
      bcConns: new Set<string>(),
    },
    on: (_event: "peers", listener: () => void) => peerListeners.add(listener),
    off: (_event: "peers", listener: () => void) =>
      peerListeners.delete(listener),
    destroy: vi.fn(),
  };

  return {
    provider,
    states,
    reset: () => {
      states.clear();
      states.set("self", {});
      provider.room.bcConns.clear();
      awarenessListeners.clear();
      peerListeners.clear();
      provider.destroy.mockClear();
    },
    emitAwareness: () => awarenessListeners.forEach((listener) => listener()),
    emitPeers: () => peerListeners.forEach((listener) => listener()),
  };
});

vi.mock("../src/yjsRoom", () => ({
  createRoomSync: () => ({
    doc: { destroy: vi.fn() },
    provider: harness.provider,
    signalingUrl: "ws://test",
    peerId: "self",
    deviceId: "device-self",
  }),
}));

vi.mock("../src/iceConfig", async () => {
  const actual =
    await vi.importActual<typeof import("../src/iceConfig")>(
      "../src/iceConfig",
    );
  return {
    ...actual,
    iceStorage: () => ({}) as ReturnType<typeof actual.iceStorage>,
    maybeFetchTurnCredentials: async () => undefined,
  };
});

import { useYRoom } from "../src/useYRoom";
import type { MeshConfig } from "../src/MeshConfig";

const config = {
  storagePrefix: "mesh-test",
  signalingUrl: "ws://test",
  turnTokenUrl: "http://127.0.0.1:1/test",
} as MeshConfig;

beforeEach(() => {
  harness.reset();
});

describe("useYRoom peer discovery", () => {
  it("counts a same-browser BroadcastChannel peer even while awareness has not caught up", async () => {
    const { result } = renderHook(() => useYRoom(config, "room"));

    await waitFor(() => expect(result.current?.peerCount).toBe(0));

    act(() => {
      harness.provider.room.bcConns.add("local-tab");
      harness.emitPeers();
    });

    await waitFor(() => expect(result.current?.peerCount).toBe(1));
  });

  it("uses the richer provider view without double-counting awareness and BroadcastChannel peers", async () => {
    const { result } = renderHook(() => useYRoom(config, "room"));

    await waitFor(() => expect(result.current?.peerCount).toBe(0));

    act(() => {
      harness.states.set("remote", {});
      harness.provider.room.bcConns.add("remote-tab");
      harness.emitAwareness();
      harness.emitPeers();
    });

    await waitFor(() => expect(result.current?.peerCount).toBe(1));

    act(() => {
      harness.states.set("remote-two", {});
      harness.emitAwareness();
    });

    await waitFor(() => expect(result.current?.peerCount).toBe(2));
  });
});
