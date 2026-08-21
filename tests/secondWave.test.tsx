// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeshPermissionGate } from "../src/MeshPermissionGate";
import { usePeerCapabilities } from "../src/usePeerCapabilities";
import { useQuorum } from "../src/useQuorum";
import { useSharedReservation } from "../src/useSharedReservation";
import { createMockRoom } from "../testing/createMockRoom";

describe("second primitive wave", () => {
  it("renders a labelled permission request and fallback", () => {
    render(<MeshPermissionGate capability="camera" onRequest={() => {}} />);
    expect(screen.getByRole("button", { name: "Enable camera" })).toBeTruthy();
    render(<MeshPermissionGate capability="motion" supported={false} onRequest={() => {}} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("reserves a capacity slot and exposes position", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useSharedReservation(room, "seats", { capacity: 1 }));
    act(() => result.current.reserve());
    expect(result.current.admitted).toBe(true);
    expect(result.current.position).toBe(1);
    act(() => result.current.release());
    expect(result.current.remaining).toBe(1);
  });

  it("has safe roomless quorum and capability states", () => {
    const quorum = renderHook(() => useQuorum(null, 2));
    expect(quorum.result.current).toMatchObject({ missing: 2, satisfied: false });
    const capabilities = renderHook(() => usePeerCapabilities(null, { camera: true }));
    expect(capabilities.result.current.supports("camera")).toBe(true);
  });
});
