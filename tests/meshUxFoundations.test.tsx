// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { createMeshConfig } from "../src/MeshConfig";
import { MeshAppFrame } from "../src/MeshAppFrame";
import {
  MeshAppProvider,
  useMeshApp,
  useOptionalMeshApp,
} from "../src/MeshAppProvider";
import {
  MeshCapabilityGate,
  type MeshCapabilitySnapshot,
} from "../src/MeshCapabilityGate";
import { MeshConnectionPanel } from "../src/MeshConnectionPanel";
import { MeshReadinessPanel } from "../src/MeshReadinessPanel";
import { MeshRoomGate } from "../src/MeshRoomGate";
import type { NetworkOnlineState } from "../src/useNetworkOnline";
import type { RoomLifecycle } from "../src/useRoomLifecycle";
import {
  useRoomDiagnostics,
  type RoomDiagnostics,
} from "../src/useRoomDiagnostics";
import { createMockRoom } from "../testing/createMockRoom";

const config = createMeshConfig({
  appName: "mesh-ux-foundations-test",
  description: "test",
  accentHex: "#123456",
  version: "1.0.0",
  commit: "test",
});

const online: NetworkOnlineState = {
  online: true,
  lastChange: 1,
  why: "probe-ok",
};
const lifecycle = (overrides: Partial<RoomLifecycle> = {}): RoomLifecycle => ({
  status: "connected",
  joinedAt: 1,
  error: null,
  reconnect: vi.fn(() => true),
  ...overrides,
});

function diagnostics(
  overrides: Partial<RoomDiagnostics> = {},
): RoomDiagnostics {
  const currentLifecycle = overrides.lifecycle ?? lifecycle();
  return {
    status: "connected",
    detail: "The shared room is connected.",
    network: online,
    lifecycle: currentLifecycle,
    providerConnected: true,
    lastStatusAt: 1,
    waitingSince: null,
    retryAttempts: 0,
    lastRetryAt: null,
    error: null,
    canRetry: true,
    isStale: false,
    retry: vi.fn(() => true),
    ...overrides,
  };
}

function Provider({ children }: { children: ReactNode }) {
  return (
    <MeshAppProvider
      config={config}
      room={null}
      lifecycle={lifecycle()}
      network={online}
    >
      {children}
    </MeshAppProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MeshAppProvider and MeshAppFrame", () => {
  it("shares canonical app state and makes missing context explicit", () => {
    const { result: outside } = renderHook(() => useOptionalMeshApp());
    expect(outside.current).toBeNull();

    const { result } = renderHook(() => useMeshApp(), { wrapper: Provider });
    expect(result.current.config.appName).toBe("mesh-ux-foundations-test");
    expect(result.current.network.online).toBe(true);

    expect(() => renderHook(() => useMeshApp())).toThrow(/MeshAppProvider/);
  });

  it("renders semantic title, navigation and slots without requiring the legacy shell", () => {
    render(
      <Provider>
        <MeshAppFrame
          eyebrow="Live"
          title="Shared board"
          description="Work together"
          navigation={<a href="#board">Board</a>}
          actions={<button>Start</button>}
          footer="Privacy first"
        >
          <p>Feature content</p>
        </MeshAppFrame>
      </Provider>,
    );
    expect(screen.getByRole("heading", { name: "Shared board" })).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Feature navigation" }),
    ).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("Feature content");
    expect(screen.getByRole("main").hasAttribute("data-mesh-app-shell")).toBe(
      true,
    );
    expect(screen.getByRole("main").getAttribute("data-mesh-room-state")).toBe(
      "connected",
    );
    expect(screen.getByText("Privacy first")).toBeTruthy();
  });
});

describe("useRoomDiagnostics", () => {
  it("distinguishes local-ready, offline, stale and provider-error states", () => {
    const localRoom = createMockRoom();
    const { result: local } = renderHook(() =>
      useRoomDiagnostics(localRoom, {
        lifecycle: lifecycle(),
        network: online,
      }),
    );
    expect(local.current.status).toBe("connected");
    expect(local.current.providerConnected).toBeNull();

    const { result: offline } = renderHook(() =>
      useRoomDiagnostics(localRoom, {
        lifecycle: lifecycle({ status: "joining" }),
        network: { ...online, online: false, why: "navigator" },
      }),
    );
    expect(offline.current.status).toBe("offline");

    let clock = 0;
    const provider = {
      connected: false,
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const waitingRoom = createMockRoom({ provider: provider as never });
    const joining = lifecycle({ status: "joining", joinedAt: null });
    const { result: delayed, rerender } = renderHook(() =>
      useRoomDiagnostics(waitingRoom, {
        lifecycle: joining,
        network: online,
        staleAfterMs: 100,
        now: () => clock,
      }),
    );
    expect(delayed.current.status).toBe("connecting");
    clock = 101;
    rerender();
    expect(delayed.current.status).toBe("stale");

    const handlers = provider.on.mock.calls.find(
      ([event]) => event === "error",
    )?.[1] as ((cause: unknown) => void) | undefined;
    act(() => handlers?.(new Error("signaling failed")));
    expect(delayed.current.status).toBe("error");
    expect(delayed.current.detail).toContain("signaling failed");
  });

  it("tracks a manual retry and delegates to lifecycle reconnect", () => {
    const provider = {
      connected: false,
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const room = createMockRoom({ provider: provider as never });
    const reconnect = vi.fn(() => true);
    const { result } = renderHook(() =>
      useRoomDiagnostics(room, {
        lifecycle: lifecycle({ status: "disconnected", reconnect }),
        network: online,
      }),
    );
    act(() => expect(result.current.retry()).toBe(true));
    expect(reconnect).toHaveBeenCalledOnce();
    expect(result.current.retryAttempts).toBe(1);
  });

  it("keeps diagnostics timing and retry history through a peer-count wrapper update", () => {
    let clock = 0;
    const provider = {
      connected: false,
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const room = createMockRoom({ provider: provider as never, peerCount: 0 });
    const reconnect = vi.fn(() => true);
    const { result, rerender } = renderHook(
      ({ currentRoom }) =>
        useRoomDiagnostics(currentRoom, {
          lifecycle: lifecycle({ status: "joining", reconnect }),
          network: online,
          staleAfterMs: 100,
          now: () => clock,
        }),
      { initialProps: { currentRoom: room } },
    );
    act(() => expect(result.current.retry()).toBe(true));
    clock = 101;
    rerender({ currentRoom: { ...room, peerCount: 3 } });
    expect(result.current.retryAttempts).toBe(1);
    expect(result.current.status).toBe("stale");
  });
});

describe("MeshRoomGate and MeshConnectionPanel", () => {
  it("offers an accessible retry and supports headless rendering", async () => {
    const retry = vi.fn(() => true);
    const pending = diagnostics({
      status: "stale",
      detail: "Taking too long",
      retry,
    });
    const { rerender } = render(
      <MeshRoomGate room={null} diagnostics={pending} />,
    );
    expect(
      screen.getByRole("heading", { name: "Room connection is delayed" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect room" }));
    await waitFor(() => expect(retry).toHaveBeenCalledOnce());

    rerender(
      <MeshRoomGate
        room={null}
        diagnostics={diagnostics()}
        render={(state) => <p>{`Headless: ${state.status}`}</p>}
      />,
    );
    expect(screen.getByText("Headless: connected")).toBeTruthy();
  });

  it("keeps detailed diagnostics progressive and labels sessions honestly", () => {
    const retry = vi.fn(() => true);
    const room = createMockRoom({ peerCount: 2 });
    render(
      <MeshConnectionPanel
        room={room}
        diagnostics={diagnostics({
          status: "stale",
          detail: "Slow room",
          retry,
        })}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Delayed");
    fireEvent.click(screen.getByText("Connection details"));
    expect(screen.getByText("Live sessions")).toBeTruthy();
    expect(screen.getByText("3 sessions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect room" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("MeshCapabilityGate", () => {
  it("requests a permission, reports aggregate state, and exposes a post-grant test slot", async () => {
    let state: PermissionState = "prompt";
    const permissionStatus = {
      get state() {
        return state;
      },
      onchange: null,
    };
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue(permissionStatus) },
    });
    const observed: Array<Readonly<Record<string, MeshCapabilitySnapshot>>> =
      [];
    render(
      <MeshCapabilityGate
        capabilities={[
          {
            id: "camera",
            label: "Camera",
            permission: "camera",
            request: async () => {
              state = "granted";
              return true;
            },
            test: <button>Test camera</button>,
          },
        ]}
        onStateChange={(snapshot) => observed.push(snapshot)}
      />,
    );
    await screen.findByText("Permission needed");
    fireEvent.click(screen.getByRole("button", { name: "Enable Camera" }));
    await screen.findByText("Ready");
    expect(screen.getByRole("button", { name: "Test camera" })).toBeTruthy();
    await waitFor(() => expect(observed.at(-1)?.camera?.status).toBe("ready"));
  });

  it("renders capability and whole-gate fallbacks for unsupported required hardware", async () => {
    render(
      <MeshCapabilityGate
        capabilities={[
          {
            id: "torch",
            label: "Torch",
            permission: "camera",
            supported: false,
            fallback: "Use the screen instead.",
          },
        ]}
        fallback="This feature needs another device."
      />,
    );
    await screen.findByText("Not supported");
    expect(screen.getByText("Use the screen instead.")).toBeTruthy();
    expect(screen.getByText("This feature needs another device.")).toBeTruthy();
  });

  it("uses an explicit Safari-style request when a permission descriptor cannot be queried", async () => {
    const originalPermissions = Object.getOwnPropertyDescriptor(
      navigator,
      "permissions",
    );
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi
          .fn()
          .mockRejectedValue(new Error("camera descriptor is unavailable")),
      },
    });
    try {
      render(
        <MeshCapabilityGate
          capabilities={[
            {
              id: "camera",
              label: "Camera",
              permission: "camera",
              request: async () => true,
            },
          ]}
        />,
      );
      await screen.findByText("Permission status unavailable");
      fireEvent.click(screen.getByRole("button", { name: "Enable Camera" }));
      await screen.findByText("Ready");
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      if (originalPermissions) {
        Object.defineProperty(navigator, "permissions", originalPermissions);
      } else {
        delete (navigator as Navigator & { permissions?: unknown }).permissions;
      }
    }
  });
});

describe("MeshReadinessPanel", () => {
  it("combines connection, required capabilities, arming, and live-session minimum", () => {
    const room = createMockRoom({ peerCount: 1 });
    const readyCapability: Pick<
      MeshCapabilitySnapshot,
      "id" | "label" | "required" | "status"
    > = {
      id: "camera",
      label: "Camera",
      required: true,
      status: "ready",
    };
    const { rerender } = render(
      <MeshReadinessPanel
        room={room}
        diagnostics={diagnostics()}
        capabilities={[readyCapability]}
        armed
        peers={{ minimum: 2 }}
      />,
    );
    expect(screen.getByText("Ready to start")).toBeTruthy();
    expect(screen.getByText("2 sessions ready")).toBeTruthy();

    rerender(
      <MeshReadinessPanel
        room={room}
        diagnostics={diagnostics()}
        capabilities={[readyCapability]}
        armed={false}
        peers={{ minimum: 3 }}
      />,
    );
    expect(screen.getByText("Not ready yet")).toBeTruthy();
    expect(screen.getByText(/Need 3 sessions/)).toBeTruthy();
  });
});
