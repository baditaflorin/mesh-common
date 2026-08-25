// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MeshCountdown,
  MeshCueBanner,
  formatMeshDuration,
  meshCueMessage,
} from "../src/MeshCountdown";
import { MeshOnboarding } from "../src/MeshOnboarding";
import { MeshRoster } from "../src/MeshRoster";
import {
  MeshSessionProvider,
  sharesKnownBrowserDevice,
  useMeshSession,
  useMeshSessionContext,
} from "../src/meshSession";
import { defineSharedEntity } from "../src/defineSharedEntity";
import {
  assertMeshUxContract,
  evaluateMeshUxContract,
} from "../src/fleetUxContract";
import { useMeshMediaFlow } from "../src/useMeshMediaFlow";
import { createMockRoom } from "../testing/createMockRoom";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("workflow foundations", () => {
  it("keeps session and device semantics explicitly browser-scoped", async () => {
    const room = createMockRoom({
      peerId: "session-a",
      deviceId: "browser-app-a",
    });
    let tick = 10;
    const session = renderHook(() =>
      useMeshSession(room, { now: () => ++tick, trackActivity: false }),
    );
    expect(session.result.current).toMatchObject({
      sessionId: "session-a",
      deviceId: "browser-app-a",
    });
    act(() => session.result.current.markActive());
    expect(session.result.current.lastActiveAt).toBe(12);
    expect(
      sharesKnownBrowserDevice(session.result.current, {
        deviceId: "browser-app-a",
      }),
    ).toBe(true);
    expect(
      sharesKnownBrowserDevice(session.result.current, {
        deviceId: "different-browser",
      }),
    ).toBe(false);

    function Probe() {
      const value = useMeshSessionContext();
      return <output>{value?.sessionId}</output>;
    }
    render(
      <MeshSessionProvider room={room} trackActivity={false}>
        <Probe />
      </MeshSessionProvider>,
    );
    expect(await screen.findByText("session-a")).toBeTruthy();
  });

  it("renders roster counts as live sessions rather than physical devices", async () => {
    const room = createMockRoom({ peerId: "alice-session" });
    render(<MeshRoster room={room} selfName="Alice" heartbeatMs={50} />);
    expect(await screen.findByText(/1 live session/)).toBeTruthy();
    expect(
      screen.getByText(
        "Counts browser sessions, not physical phones or people.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("session alice-se")).toBeTruthy();
  });

  it("does not collapse simultaneous sessions that share one browser id", async () => {
    const room = createMockRoom({
      peerId: "tab-a",
      deviceId: "same-browser",
    });
    act(() => {
      const now = Date.now();
      room.doc.getMap<number>("__mesh_roster").set("tab-a", now);
      room.doc.getMap<number>("__mesh_roster").set("tab-b", now);
      room.doc
        .getMap<string>("__mesh_roster_device")
        .set("tab-a", "same-browser");
      room.doc
        .getMap<string>("__mesh_roster_device")
        .set("tab-b", "same-browser");
    });
    render(<MeshRoster room={room} heartbeatMs={50} />);
    expect(await screen.findByText("2 live sessions")).toBeTruthy();
  });

  it("presents countdown and stale/lateness cue states with safe actions", () => {
    expect(formatMeshDuration(0)).toBe("0:00");
    expect(formatMeshDuration(61_000)).toBe("1:01");
    expect(meshCueMessage("expired", 0, 2_000)).toContain("expired");
    const cancel = vi.fn(() => true);
    const clear = vi.fn(() => true);
    const { rerender } = render(
      <>
        <MeshCountdown
          timer={{
            state: "running",
            durationMs: 10_000,
            elapsedMs: 2_000,
            remainingMs: 8_000,
          }}
        />
        <MeshCueBanner
          controller={{
            cue: null,
            state: "scheduled",
            remainingMs: 2_000,
            latenessMs: null,
            cancel,
            clear,
          }}
        />
      </>,
    );
    expect(
      screen
        .getByLabelText(/Shared timer: Remaining 0:08/)
        .getAttribute("aria-live"),
    ).toBe("off");
    fireEvent.click(screen.getByRole("button", { name: "Cancel cue" }));
    expect(cancel).toHaveBeenCalledOnce();
    rerender(
      <MeshCueBanner
        controller={{
          cue: null,
          state: "expired",
          remainingMs: 0,
          latenessMs: 1_000,
          cancel,
          clear,
        }}
      />,
    );
    expect(screen.getByText(/Cue expired/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear cue" }));
    expect(clear).toHaveBeenCalledOnce();
  });

  it("keeps visual timer ticks quiet and announces cue/timer state changes once", () => {
    vi.useFakeTimers();
    try {
      const timerView = render(
        <MeshCountdown
          announce
          timer={{
            state: "running",
            durationMs: 10_000,
            elapsedMs: 1_000,
            remainingMs: 9_000,
          }}
        />,
      );
      const timerRegion = document.querySelector(".mesh-live-region");
      expect(
        screen.getByLabelText(/Shared timer/).getAttribute("aria-live"),
      ).toBe("off");
      timerView.rerender(
        <MeshCountdown
          announce
          timer={{
            state: "running",
            durationMs: 10_000,
            elapsedMs: 2_000,
            remainingMs: 8_000,
          }}
        />,
      );
      act(() => vi.advanceTimersByTime(100));
      expect(timerRegion?.textContent).toBe("");
      timerView.rerender(
        <MeshCountdown
          announce
          timer={{
            state: "finished",
            durationMs: 10_000,
            elapsedMs: 10_000,
            remainingMs: 0,
          }}
        />,
      );
      act(() => vi.advanceTimersByTime(100));
      expect(timerRegion?.textContent).toContain("Timer finished");
      timerView.unmount();

      const cueView = render(
        <MeshCueBanner
          controller={{
            cue: null,
            state: "scheduled",
            remainingMs: 1_000,
            latenessMs: null,
            cancel: vi.fn(() => true),
            clear: vi.fn(() => true),
          }}
        />,
      );
      const cueRegion = document.querySelector(".mesh-live-region");
      cueView.rerender(
        <MeshCueBanner
          controller={{
            cue: null,
            state: "due",
            remainingMs: 0,
            latenessMs: 0,
            cancel: vi.fn(() => true),
            clear: vi.fn(() => true),
          }}
        />,
      );
      act(() => vi.advanceTimersByTime(100));
      expect(cueRegion?.textContent).toContain("Cue is live now");
      cueView.rerender(
        <MeshCueBanner
          controller={{
            cue: null,
            state: "due",
            remainingMs: 0,
            latenessMs: 1_000,
            cancel: vi.fn(() => true),
            clear: vi.fn(() => true),
          }}
        />,
      );
      act(() => vi.advanceTimersByTime(100));
      expect(cueRegion?.textContent).toContain("Cue is live now");
    } finally {
      vi.useRealTimers();
    }
  });

  it("defines validated, stamped shared entities with safe mutation recipes", () => {
    type Note = { id: string; title: string; updatedBy?: string };
    const notes = defineSharedEntity<Note, { title: string }>({
      key: "workflow-notes",
      createId: () => "note-1",
      create: ({ title }, context) => ({ id: context.id, title }),
      validate: (value): value is Note =>
        typeof value === "object" &&
        value !== null &&
        typeof (value as Note).id === "string" &&
        typeof (value as Note).title === "string" &&
        (value as Note).title.length > 0,
      stamp: (entity, context) => ({ ...entity, updatedBy: context.peerId }),
    });
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => notes.useCollection(room));
    act(() =>
      expect(result.current.create({ title: "First" })).toEqual({
        id: "note-1",
        title: "First",
        updatedBy: "alice",
      }),
    );
    act(() =>
      expect(
        result.current.mutate("note-1", (current) => ({
          title: `${current.title}!`,
        })),
      ).toBe(true),
    );
    expect(result.current.byId("note-1")).toEqual({
      id: "note-1",
      title: "First!",
      updatedBy: "alice",
    });
    act(() =>
      room.doc
        .getArray<unknown>("workflow-notes")
        .push([{ id: "bad", title: "" }]),
    );
    expect(result.current.invalidItems).toBe(1);
  });

  it("requires explicit media-share consent and cleans local pending state on revoke", async () => {
    const { result } = renderHook(() => useMeshMediaFlow(null));
    let shared: string | null = "unexpected";
    await act(async () => {
      shared = await result.current.shareFile(new Blob(["local"]));
    });
    expect(shared).toBeNull();
    expect(result.current.error).toContain("Grant consent");
    act(() => result.current.grantConsent());
    expect(result.current.consented).toBe(true);
    act(() =>
      result.current.files.add([
        new File(["x"], "local.txt", { type: "text/plain" }),
      ]),
    );
    expect(result.current.files.files).toHaveLength(1);
    act(() => result.current.revokeConsent());
    expect(result.current).toMatchObject({
      consented: false,
      state: "idle",
      captured: null,
    });
    expect(result.current.files.files).toHaveLength(0);
  });

  it("never opens a camera from persisted consent without a fresh gesture", () => {
    const originalMediaDevices = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaDevices",
    );
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    try {
      const { result } = renderHook(() =>
        useMeshMediaFlow(null, { initialConsent: true }),
      );
      expect(result.current.consented).toBe(true);
      expect(result.current.state).toBe("idle");
      expect(getUserMedia).not.toHaveBeenCalled();
    } finally {
      if (originalMediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
      } else {
        delete (navigator as Navigator & { mediaDevices?: unknown })
          .mediaDevices;
      }
    }
  });

  it("recovers a media flow after a denied camera request is retried", async () => {
    const originalMediaDevices = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaDevices",
    );
    let granted = false;
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          if (!granted) throw new Error("Camera permission denied");
          return { getTracks: () => [track] } as unknown as MediaStream;
        }),
      },
    });
    try {
      const { result } = renderHook(() => useMeshMediaFlow(null));
      act(() => result.current.grantConsent());
      await waitFor(() =>
        expect(result.current.error).toContain("Camera permission denied"),
      );

      act(() => result.current.revokeConsent());
      granted = true;
      act(() => result.current.grantConsent());
      await waitFor(() => {
        expect(result.current.camera.ready).toBe(true);
        expect(result.current.error).toBeNull();
        expect(result.current.state).toBe("ready");
      });
    } finally {
      if (originalMediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
      } else {
        delete (navigator as Navigator & { mediaDevices?: unknown })
          .mediaDevices;
      }
    }
  });

  it("keeps the five onboarding stages keyboard reachable and blocks incomplete prerequisites", () => {
    const onComplete = vi.fn();
    const view = render(
      <MeshOnboarding
        completed={{ identity: false }}
        onComplete={onComplete}
        steps={{ identity: { content: <input aria-label="Display name" /> } }}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    view.rerender(
      <MeshOnboarding completed={{ identity: true }} onComplete={onComplete} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Join a room" })).toBeTruthy();
    fireEvent.keyDown(
      screen.getByRole("button", { name: /2\. Join a room, current step/ }),
      { key: "ArrowRight" },
    );
    expect(
      screen.getByRole("heading", { name: "Review permissions" }),
    ).toBeTruthy();
  });

  it("honors a step-local completion requirement when no completed map is supplied", () => {
    render(
      <MeshOnboarding
        steps={{ identity: { complete: false, content: "Pick a name first." } }}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("evaluates fleet UX shell, lifecycle, feedback and control labels without adding CI", () => {
    const { container } = render(
      <main data-mesh-app-shell>
        <h1>Demo</h1>
        <p data-mesh-room-state="connected" role="status">
          Connected
        </p>
        <div data-mesh-empty-state>Nothing here</div>
        <button aria-label="Open settings" />
        <img alt="Mesh preview" src="data:,preview" />
        <div role="dialog" aria-label="Invite" />
      </main>,
    );
    const options = {
      root: container,
      requiresRoomLifecycle: true,
      requiresLiveFeedback: true,
      requiresEmptyState: true,
      supportsMobileSafeArea: true,
      supportsReducedMotion: true,
      lifecycleCoverage: {
        loading: true,
        joining: true,
        connected: true,
        offline: true,
        error: true,
      },
    } as const;
    expect(evaluateMeshUxContract(options)).toMatchObject({
      valid: true,
      lifecycleState: "connected",
    });
    expect(assertMeshUxContract(options).valid).toBe(true);
    expect(
      evaluateMeshUxContract({
        root: document.createElement("div"),
      }).violations.map((item) => item.code),
    ).toContain("missing-app-shell");
  });
});
