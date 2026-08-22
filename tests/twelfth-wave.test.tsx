// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useSharedNotes,
  useSharedPoll,
  useSharedReactions,
  useSharedRoles,
  useSharedRound,
} from "../src";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

describe("twelfth primitive wave", () => {
  it("stores one valid poll choice per peer", async () => {
    const a = createMockRoom({ peerId: "a" });
    const b = createMockRoom({ peerId: "b" });
    const unlink = linkMockRooms(a, b);
    const first = renderHook(() => useSharedPoll(a));
    const second = renderHook(() => useSharedPoll(b));
    const options = [{ id: "tea", label: "Tea" }];
    act(() => expect(first.result.current.vote("tea", options)).toBe(true));
    await waitFor(() => expect(second.result.current.votes).toHaveLength(1));
    expect(first.result.current.vote("missing", options)).toBe(false);
    unlink();
  });
  it("prevents a second peer from claiming an occupied role", async () => {
    const a = createMockRoom({ peerId: "a" });
    const b = createMockRoom({ peerId: "b" });
    const unlink = linkMockRooms(a, b);
    const first = renderHook(() => useSharedRoles(a));
    const second = renderHook(() => useSharedRoles(b));
    act(() => expect(first.result.current.claim("Host")).toBe(true));
    await waitFor(() => expect(second.result.current.claims).toHaveLength(1));
    expect(second.result.current.claim("Host")).toBe(false);
    unlink();
  });
  it("replicates attributed notes and only allows the author to remove one", async () => {
    const a = createMockRoom({ peerId: "a" });
    const b = createMockRoom({ peerId: "b" });
    const unlink = linkMockRooms(a, b);
    const first = renderHook(() => useSharedNotes(a));
    const second = renderHook(() => useSharedNotes(b));
    act(() =>
      expect(first.result.current.add("  Keep it local  ", "note")).toBe(true),
    );
    await waitFor(() =>
      expect(second.result.current.notes[0]?.text).toBe("Keep it local"),
    );
    expect(second.result.current.remove("note")).toBe(false);
    unlink();
  });
  it("replicates round advances and deduplicated peer reactions", async () => {
    const a = createMockRoom({ peerId: "a" });
    const b = createMockRoom({ peerId: "b" });
    const unlink = linkMockRooms(a, b);
    const first = renderHook(() => ({
      round: useSharedRound(a),
      reactions: useSharedReactions(a),
    }));
    const second = renderHook(() => ({
      round: useSharedRound(b),
      reactions: useSharedReactions(b),
    }));
    act(() => {
      first.result.current.round.next();
      first.result.current.reactions.toggle("👏");
    });
    await waitFor(() =>
      expect(second.result.current.round.round.number).toBe(1),
    );
    await waitFor(() =>
      expect(second.result.current.reactions.reactions[0]?.count).toBe(1),
    );
    unlink();
  });
});
