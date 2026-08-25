// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  MeshShellConnectionBridge,
  MeshShellConnectionBridgeProvider,
  useMeshShellConnectionBridge,
} from "../src/MeshShellConnectionBridge";
import type { NetworkOnlineState } from "../src/useNetworkOnline";
import type { RoomLifecycle } from "../src/useRoomLifecycle";
import type { YRoom } from "../src/useYRoom";
import { createMockRoom } from "../testing/createMockRoom";

afterEach(cleanup);

function lifecycle(status: RoomLifecycle["status"]): RoomLifecycle {
  return {
    status,
    joinedAt: status === "connected" ? 100 : null,
    error: null,
    reconnect: () => true,
  };
}

function ConnectionProbe() {
  const { connection } = useMeshShellConnectionBridge();
  if (!connection) return <output>none</output>;
  return (
    <output>
      {[
        connection.room.peerId,
        connection.room.peerCount,
        connection.lifecycle?.status ?? "no-lifecycle",
        connection.network?.online ?? "no-network",
      ].join("|")}
    </output>
  );
}

function Harness({
  room,
  currentLifecycle,
  network,
  mounted = true,
}: {
  room: YRoom | null | undefined;
  currentLifecycle?: RoomLifecycle;
  network?: NetworkOnlineState;
  mounted?: boolean;
}) {
  return (
    <MeshShellConnectionBridgeProvider>
      {mounted ? (
        <MeshShellConnectionBridge
          room={room}
          lifecycle={currentLifecycle}
          network={network}
        />
      ) : null}
      <ConnectionProbe />
    </MeshShellConnectionBridgeProvider>
  );
}

describe("MeshShellConnectionBridge", () => {
  it("reports only an existing feature-owned room and follows dynamic lifecycle/network updates", () => {
    const first = createMockRoom({
      peerId: "gesture-room",
      peerCount: 1,
      roomId: "first-room",
    });
    const second = createMockRoom({
      peerId: "replacement-room",
      peerCount: 3,
      roomId: "second-room",
    });
    const online: NetworkOnlineState = {
      online: true,
      lastChange: 1,
      why: "navigator",
    };
    const offline: NetworkOnlineState = {
      online: false,
      lastChange: 2,
      why: "probe-failed",
    };
    const joining = lifecycle("joining");
    const { rerender } = render(
      <Harness
        room={null}
        currentLifecycle={lifecycle("idle")}
        network={online}
      />,
    );

    expect(screen.getByText("none")).toBeTruthy();

    rerender(
      <Harness room={first} currentLifecycle={joining} network={online} />,
    );
    expect(screen.getByText("gesture-room|1|joining|true")).toBeTruthy();

    // Some feature-owned room adapters retain their YRoom wrapper while
    // updating awareness-derived peer count. Scalar bridge dependencies keep
    // this report fresh rather than requiring a new connection instance.
    first.peerCount = 2;
    rerender(
      <Harness room={first} currentLifecycle={joining} network={online} />,
    );
    expect(screen.getByText("gesture-room|2|joining|true")).toBeTruthy();

    rerender(
      <Harness
        room={second}
        currentLifecycle={lifecycle("connected")}
        network={offline}
      />,
    );
    expect(screen.getByText("replacement-room|3|connected|false")).toBeTruthy();

    rerender(
      <Harness
        room={null}
        currentLifecycle={lifecycle("idle")}
        network={online}
      />,
    );
    expect(screen.getByText("none")).toBeTruthy();
  });

  it("clears a report when its feature unmounts", () => {
    const room = createMockRoom({ peerId: "cleanup-room" });
    const { rerender } = render(
      <Harness room={room} currentLifecycle={lifecycle("joining")} />,
    );

    expect(screen.getByText("cleanup-room|0|joining|no-network")).toBeTruthy();

    rerender(
      <Harness
        room={room}
        currentLifecycle={lifecycle("joining")}
        mounted={false}
      />,
    );
    expect(screen.getByText("none")).toBeTruthy();
  });

  it("supports an imperative report and clear for event-driven feature owners", () => {
    const room = createMockRoom({ peerId: "manual-room" });
    function ManualReporter() {
      const { connection, report, clear } = useMeshShellConnectionBridge();
      return (
        <>
          <button type="button" onClick={() => report({ room })}>
            report
          </button>
          <button type="button" onClick={clear}>
            clear
          </button>
          <output>{connection?.room.peerId ?? "none"}</output>
        </>
      );
    }

    render(
      <MeshShellConnectionBridgeProvider>
        <ManualReporter />
      </MeshShellConnectionBridgeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "report" }));
    expect(screen.getByText("manual-room")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByText("none")).toBeTruthy();
  });

  it("is a harmless no-op before MeshShell mounts its provider", () => {
    expect(() =>
      render(<MeshShellConnectionBridge room={createMockRoom()} />),
    ).not.toThrow();
  });
});
