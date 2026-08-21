// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MeshConnectionStatus } from "../src/MeshConnectionStatus";
import type { NetworkOnlineState } from "../src/useNetworkOnline";

beforeEach(() => {
  // The component keeps its hook order stable even when callers provide a
  // network result, so prevent an incidental test probe from reaching the net.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const online: NetworkOnlineState = {
  online: true,
  lastChange: 0,
  why: "probe-ok",
};

describe("MeshConnectionStatus", () => {
  it("reports an offline network state accessibly", () => {
    render(
      <MeshConnectionStatus
        network={{ ...online, online: false, why: "probe-failed" }}
      />,
    );

    const status = screen.getByRole("status");
    expect(status.getAttribute("data-state")).toBe("offline");
    expect(status.textContent).toContain("Offline");
    expect(status.getAttribute("aria-label")).toContain("Network unavailable");
  });

  it("shows a connected room's peer count", () => {
    render(
      <MeshConnectionStatus
        network={online}
        room={{ peerCount: 3, peerId: "me", roomId: "room", doc: {} as never, provider: null }}
      />,
    );

    const status = screen.getByRole("status");
    expect(status.getAttribute("data-state")).toBe("connected");
    expect(status.textContent).toContain("3 peers connected");
  });

  it("distinguishes a room that is still starting", () => {
    render(<MeshConnectionStatus network={online} room={null} compact />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("data-state")).toBe("connecting");
    expect(status.textContent).toContain("Connecting");
    expect(status.textContent).not.toContain("Joining room");
  });
});
