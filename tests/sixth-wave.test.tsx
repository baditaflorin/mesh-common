// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import { useAvailabilityGrid } from "../src/useAvailabilityGrid";
import { useRankedBallot } from "../src/useRankedBallot";
import { useSharedForm } from "../src/useSharedForm";

describe("sixth capability wave", () => {
  it("derives common availability and a deterministic ranked winner", () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() =>
      useAvailabilityGrid(alice, "slots", ["alice", "bob"]),
    );
    const b = renderHook(() =>
      useAvailabilityGrid(bob, "slots", ["alice", "bob"]),
    );
    act(() => {
      a.result.current.setAvailable("09:00", true);
      b.result.current.setAvailable("09:00", true);
    });
    expect(a.result.current.commonSlots).toEqual(["09:00"]);
    const ballotA = renderHook(() => useRankedBallot(alice, "ballot"));
    const ballotB = renderHook(() => useRankedBallot(bob, "ballot"));
    act(() => {
      ballotA.result.current.rank("tea");
      ballotA.result.current.rank("coffee");
      ballotB.result.current.rank("tea");
    });
    expect(ballotA.result.current.result.winner).toBe("tea");
    unlink();
  });

  it("replicates validated shared form fields", () => {
    const room = createMockRoom({ peerId: "alice" });
    const form = renderHook(() =>
      useSharedForm(room, "form", { name: "" }, (values) =>
        values.name ? {} : { name: "required" },
      ),
    );
    expect(form.result.current.submit()).toBe(false);
    act(() => form.result.current.setField("name", "Ari"));
    expect(form.result.current.values.name).toBe("Ari");
    expect(form.result.current.submit()).toBe(true);
  });
});
