// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Awareness } from "y-protocols/awareness.js";
import * as Y from "yjs";
import {
  createMeshConfig,
  meshAccentText,
  type MeshConfig,
} from "../src/MeshConfig";
import { MeshShell } from "../src/MeshShell";
import { MeshShellConnectionBridge } from "../src/MeshShellConnectionBridge";
import {
  MeshAppProvider,
  useMeshApp,
  useOptionalMeshApp,
} from "../src/MeshAppProvider";
import { useMeshSessionContext } from "../src/meshSession";
import { MeshThemeProvider, useMeshTheme } from "../src/ui/MeshThemeProvider";
import { getMeshVisualProfileTokens } from "../src/ui/MeshVisualProfile";
import type { NetworkOnlineState } from "../src/useNetworkOnline";
import type { RoomLifecycle } from "../src/useRoomLifecycle";
import type { YRoom } from "../src/useYRoom";
import { createMockRoom } from "../testing/createMockRoom";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const config = createMeshConfig({
  appName: "mesh-shell-foundation-test",
  description: "test app",
  accentHex: "#123456",
  version: "1.0.0",
  commit: "test",
});

function FoundationProbe() {
  const app = useMeshApp();
  const session = useMeshSessionContext();
  const theme = useMeshTheme();
  return (
    <output>
      {`${app.config.appName}|${session?.sessionId}|${theme.tokens.accent}`}
    </output>
  );
}

function CustomShellProbe() {
  const app = useOptionalMeshApp();
  const session = useMeshSessionContext();
  const theme = useMeshTheme();
  return (
    <output>{`${app ? "app-context" : "missing-context"}|${session?.sessionId}|${theme.tokens.canvas}`}</output>
  );
}

const browserOnline: NetworkOnlineState = {
  online: true,
  lastChange: 1,
  why: "navigator",
};

function lifecycle(
  status: RoomLifecycle["status"],
  error: Error | null = null,
): RoomLifecycle {
  return { status, joinedAt: null, error, reconnect: () => true };
}

describe("MeshShell foundation bridge", () => {
  it("keeps hand-authored legacy config literals usable", () => {
    const literalConfig: MeshConfig = {
      appName: "mesh-literal-config",
      storagePrefix: "mesh-literal-config",
      description: "A compatibility test",
      accentHex: "#3aa8a1",
      version: "1.0.0",
      commit: "literal",
      repositoryUrl: "https://github.com/baditaflorin/mesh-literal-config",
      pagesUrl: "https://baditaflorin.github.io/mesh-literal-config/",
      signalingUrl: "wss://turn.0docker.com/ws",
      turnTokenUrl: "https://turn.0docker.com/credentials",
      paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
    };
    localStorage.setItem("__mesh_beacon_optout", "1");
    render(
      <MeshShell
        config={literalConfig}
        roomId="shared-room"
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <p>Feature</p>
      </MeshShell>,
    );

    expect(screen.queryByText("Literal Config")).toBeNull();
    expect(
      document
        .querySelector("[data-mesh-app-shell]")
        ?.getAttribute("data-mesh-visual-profile"),
    ).toBe("utility");
    expect(
      document
        .querySelector("[data-mesh-app-shell]")
        ?.getAttribute("data-mesh-shell-layout"),
    ).toBe("legacy");
    expect(document.querySelector(".mesh-app-bar")).toBeNull();
    expect(document.querySelector(".mesh-self-ref")).toBeTruthy();
    expect(document.querySelector(".mesh-legacy-invite")).toBeTruthy();
  });

  it("chooses a readable foreground for arbitrary app accent colors", () => {
    const darkAccent = createMeshConfig({
      appName: "mesh-dark-accent",
      description: "test",
      accentHex: "#8046a5",
      version: "1.0.0",
      commit: "test",
    });
    localStorage.setItem("__mesh_beacon_optout", "1");
    render(
      <MeshShell
        config={darkAccent}
        roomId="shared-room"
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <p>Feature</p>
      </MeshShell>,
    );

    expect(
      document.documentElement.style.getPropertyValue("--mesh-accent-text"),
    ).toBe("#ffffff");
  });

  it("keeps the readable accent foreground when an app owns the outer theme", () => {
    const darkAccent = createMeshConfig({
      appName: "mesh-owned-theme",
      description: "test",
      accentHex: "#8046a5",
      version: "1.0.0",
      commit: "test",
    });
    const room = createMockRoom({ peerId: "owned-theme" });
    localStorage.setItem("__mesh_beacon_optout", "1");
    render(
      <MeshThemeProvider
        tokens={{
          ...getMeshVisualProfileTokens("utility"),
          accent: darkAccent.accentHex,
          accentText: meshAccentText(darkAccent.accentHex),
        }}
      >
        <MeshAppProvider
          config={darkAccent}
          room={room}
          lifecycle={lifecycle("connected")}
          network={browserOnline}
        >
          <MeshShell
            config={darkAccent}
            roomId="shared-room"
            room={room}
            onRoomChange={() => {}}
            fleetIdentityServiceUrl={null}
          >
            <p>Feature</p>
          </MeshShell>
        </MeshAppProvider>
      </MeshThemeProvider>,
    );

    expect(
      document.documentElement.style.getPropertyValue("--mesh-accent-text"),
    ).toBe("#ffffff");
  });

  it("uses human-facing product chrome and moves developer metadata into Settings", () => {
    localStorage.setItem("__mesh_beacon_optout", "1");
    render(
      <MeshShell
        config={{ ...config, shellLayout: "inset" }}
        roomId="shared-room"
        room={createMockRoom({ peerId: "visual-shell" })}
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <p>Feature</p>
      </MeshShell>,
    );

    expect(screen.getByText("Shell Foundation Test")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Invite people to Shell Foundation Test",
      }),
    ).toBeTruthy();
    expect(document.querySelector(".mesh-self-ref")).toBeNull();
    const shell = document.querySelector("[data-mesh-app-shell]");
    expect(shell?.getAttribute("data-mesh-visual-profile")).toBe("utility");
    expect(document.querySelector(".mesh-app-content")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("link", { name: "source" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "support" })).toBeTruthy();
  });

  it("gives legacy shells the app, theme, and session foundations without a network probe", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem("__mesh_beacon_optout", "1");
    const room = createMockRoom({ peerId: "legacy-session" });

    render(
      <MeshShell
        config={config}
        roomId="shared-room"
        room={room}
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <FoundationProbe />
      </MeshShell>,
    );

    expect(
      screen.getByText(/mesh-shell-foundation-test\|legacy-session/),
    ).toBeTruthy();
    const shell = document.querySelector("[data-mesh-app-shell]");
    expect(shell?.getAttribute("data-mesh-room-state")).toBe("joining");
    expect(
      document.documentElement.style.getPropertyValue("--mesh-accent"),
    ).toBe("#123456");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("adds progressive connection diagnostics inside the existing settings surface", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem("__mesh_beacon_optout", "1");
    render(
      <MeshShell
        config={config}
        roomId="shared-room"
        room={createMockRoom({ peerId: "legacy-session" })}
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <p>Feature</p>
      </MeshShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Connected");
    expect(screen.getByText("Connection details")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the shell settings FAB distinct from an app-local Open settings control", () => {
    localStorage.setItem("__mesh_beacon_optout", "1");
    render(
      <MeshShell
        config={config}
        roomId="shared-room"
        room={createMockRoom({ peerId: "duplicate-settings-label" })}
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <button type="button">Open settings</button>
        <p>Feature</p>
      </MeshShell>,
    );

    expect(
      screen.getAllByRole("button", { name: "Open settings" }),
    ).toHaveLength(2);
    const shellFab =
      document.querySelector<HTMLButtonElement>(".mesh-settings-fab");
    expect(shellFab).not.toBeNull();
    expect(shellFab?.disabled).toBe(false);
    fireEvent.click(shellFab!);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
  });

  it("opens awareness-backed diagnostics without restarting its own ping loop", async () => {
    localStorage.setItem("__mesh_beacon_optout", "1");
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const setLocalState = vi.spyOn(awareness, "setLocalState");
    const pingWrites = () =>
      setLocalState.mock.calls.filter(([state]) =>
        Boolean((state as { pingNonce?: string } | null)?.pingNonce),
      ).length;
    const room: YRoom = {
      doc,
      provider: { connected: true, awareness } as unknown as YRoom["provider"],
      peerId: "diagnostics-awareness",
      peerCount: 0,
      roomId: "awareness-settings",
    };

    try {
      render(
        <MeshShell
          config={config}
          roomId="shared-room"
          room={room}
          onRoomChange={() => {}}
          fleetIdentityServiceUrl={null}
        >
          <p>Feature</p>
        </MeshShell>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
      expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
      expect(screen.getByLabelText("Connection diagnostics")).toBeTruthy();
      await waitFor(() => expect(pingWrites()).toBe(1));
    } finally {
      doc.destroy();
    }
  });

  it("maps legacy lifecycle values to contract-safe shell states", () => {
    const room = createMockRoom({ peerId: "provided-session" });
    const renderProvided = (currentLifecycle: RoomLifecycle) => (
      <MeshAppProvider
        config={config}
        room={room}
        lifecycle={currentLifecycle}
        network={browserOnline}
      >
        <MeshShell
          config={config}
          roomId="shared-room"
          room={room}
          onRoomChange={() => {}}
          fleetIdentityServiceUrl={null}
        >
          <p>Feature</p>
        </MeshShell>
      </MeshAppProvider>
    );
    const { rerender } = render(renderProvided(lifecycle("idle")));
    const shell = () => document.querySelector("[data-mesh-app-shell]");
    expect(shell()?.getAttribute("data-mesh-room-state")).toBe("loading");

    rerender(renderProvided(lifecycle("disconnected")));
    expect(shell()?.getAttribute("data-mesh-room-state")).toBe("joining");

    rerender(renderProvided(lifecycle("connected")));
    expect(shell()?.getAttribute("data-mesh-room-state")).toBe("connected");

    rerender(renderProvided(lifecycle("joining", new Error("signal failed"))));
    expect(shell()?.getAttribute("data-mesh-room-state")).toBe("error");
  });

  it("does not invent a second room or diagnostics for feature-owned room apps", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem("__mesh_beacon_optout", "1");
    render(
      <MeshShell
        config={config}
        roomId="shared-room"
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <CustomShellProbe />
      </MeshShell>,
    );

    expect(screen.getByText(/^app-context\|/)).toBeTruthy();
    const shell = document.querySelector("[data-mesh-app-shell]");
    expect(shell?.hasAttribute("data-mesh-room-state")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.queryByText("Connection details")).toBeNull();
  });

  it("lets a feature-owned room report honest diagnostics after its own gesture", async () => {
    localStorage.setItem("__mesh_beacon_optout", "1");
    const room = createMockRoom({ peerId: "feature-session", roomId: "armed" });
    render(
      <MeshShell
        config={config}
        roomId="shared-room"
        onRoomChange={() => {}}
        fleetIdentityServiceUrl={null}
      >
        <MeshShellConnectionBridge
          room={room}
          lifecycle={lifecycle("connected")}
          network={browserOnline}
        />
        <p>Feature</p>
      </MeshShell>,
    );

    const shell = () => document.querySelector("[data-mesh-app-shell]");
    await waitFor(() =>
      expect(shell()?.getAttribute("data-mesh-room-state")).toBe("connected"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByText("Connection details")).toBeTruthy();
  });
});
