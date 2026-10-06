// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  summarizeMediaStats,
  useMediaDiagnostics,
  useMediaRoom,
  type MediaRoomEvent,
  type MediaRoomSession,
  type MediaRoomTransport,
} from "../src";

function makeTransport() {
  const listeners = new Set<(event: MediaRoomEvent) => void>();
  const session: MediaRoomSession = {
    publish: vi.fn(async () => undefined),
    unpublish: vi.fn(async () => undefined),
    close: vi.fn(),
    subscribe: vi.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const transport: MediaRoomTransport = { join: vi.fn(async () => session) };
  return {
    session,
    transport,
    emit: (event: MediaRoomEvent) => listeners.forEach((listener) => listener(event)),
  };
}

describe("live media room primitives", () => {
  it("joins explicitly, tracks peer streams, publishes and closes the transport session", async () => {
    const fake = makeTransport();
    const { result } = renderHook(() =>
      useMediaRoom({ roomId: "watch-party", peerId: "host-1", transport: fake.transport }),
    );
    expect(fake.transport.join).not.toHaveBeenCalled();
    await act(async () => expect(await result.current.join()).toBe(true));
    expect(result.current.status).toBe("connected");
    expect(fake.transport.join).toHaveBeenCalledWith({ roomId: "watch-party", peerId: "host-1", iceServers: undefined });

    const stream = {} as MediaStream;
    act(() => {
      fake.emit({ type: "peer", peer: { peerId: "viewer-1", displayName: "Viewer" }, connected: true });
      fake.emit({ type: "stream", peerId: "viewer-1", stream });
    });
    expect(result.current.peers.get("viewer-1")?.displayName).toBe("Viewer");
    expect(result.current.streams.get("viewer-1")).toBe(stream);
    await act(async () => expect(await result.current.publish(stream)).toBe(true));
    expect(fake.session.publish).toHaveBeenCalledWith(stream);

    await act(async () => result.current.leave());
    expect(fake.session.close).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("disconnected");
    expect(result.current.peers.size).toBe(0);
    expect(result.current.streams.size).toBe(0);
  });

  it("clears a departed peer's stream and reports transport errors", async () => {
    const fake = makeTransport();
    const { result } = renderHook(() =>
      useMediaRoom({ roomId: "r", peerId: "host", transport: fake.transport }),
    );
    await act(async () => result.current.join());
    const stream = {} as MediaStream;
    act(() => {
      fake.emit({ type: "peer", peer: { peerId: "viewer" }, connected: true });
      fake.emit({ type: "stream", peerId: "viewer", stream });
      fake.emit({ type: "peer", peer: { peerId: "viewer" }, connected: false });
      fake.emit({ type: "error", error: new Error("relay unavailable") });
    });
    expect(result.current.peers.has("viewer")).toBe(false);
    expect(result.current.streams.has("viewer")).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("relay unavailable");
  });

  it("closes the current session when the room identity changes", async () => {
    const fake = makeTransport();
    const { result, rerender } = renderHook(
      ({ roomId }: { roomId: string }) =>
        useMediaRoom({ roomId, peerId: "host", transport: fake.transport }),
      { initialProps: { roomId: "first-room" } },
    );
    await act(async () => result.current.join());
    rerender({ roomId: "second-room" });
    await waitFor(() => expect(result.current.status).toBe("disconnected"));
    expect(fake.session.close).toHaveBeenCalledOnce();
  });

  it("summarizes selected-pair RTT, media jitter, packet loss, and bitrate", () => {
    const report = [
      { type: "transport", selectedCandidatePairId: "pair-current" },
      { id: "pair-old", type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.8 },
      { id: "pair-current", type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.045 },
      { type: "inbound-rtp", kind: "video", bytesReceived: 5000, packetsLost: 3, jitter: 0.012 },
      { type: "outbound-rtp", kind: "video", bytesSent: 9000 },
      { type: "inbound-rtp", kind: "data", bytesReceived: 999999, packetsLost: 500 },
    ];
    const snapshot = summarizeMediaStats(
      report,
      { at: 1000, inbound: 1000, outbound: 1000 },
      2000,
    );
    expect(snapshot).toMatchObject({
      roundTripMs: 45,
      inboundKbps: 32,
      outboundKbps: 64,
      packetsLost: 3,
      jitterMs: 12,
    });
  });

  it("polls a supplied peer connection and resets when it changes", async () => {
    const getStats = vi.fn(async () => new Map([
      ["inbound", { type: "inbound-rtp", kind: "audio", bytesReceived: 1000, packetsLost: 0, jitter: 0.004 }],
    ]) as unknown as RTCStatsReport);
    const connection = { getStats } as unknown as RTCPeerConnection;
    const { result, rerender } = renderHook(
      ({ pc }: { pc: RTCPeerConnection | null }) => useMediaDiagnostics(pc),
      { initialProps: { pc: connection } },
    );
    await waitFor(() => expect(result.current.snapshot?.jitterMs).toBe(4));
    expect(result.current.supported).toBe(true);
    rerender({ pc: null });
    await waitFor(() => expect(result.current.snapshot).toBeNull());
    expect(result.current.supported).toBe(false);
  });
});
