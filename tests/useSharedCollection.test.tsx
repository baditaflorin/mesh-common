// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import { useSharedCollection } from "../src/useSharedCollection";

type Task = { id: string; title: string; done: boolean };

describe("useSharedCollection", () => {
  it("adds, updates, reorders and removes stable-id items", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() => useSharedCollection<Task>(room, "tasks"));

    act(() => {
      expect(result.current.add({ id: "a", title: "First", done: false })).toBe(true);
      expect(result.current.add({ id: "b", title: "Second", done: false })).toBe(true);
    });
    act(() => expect(result.current.update("a", { done: true })).toBe(true));
    expect(result.current.byId("a")).toEqual({ id: "a", title: "First", done: true });

    act(() => expect(result.current.move("b", 0)).toBe(true));
    expect(result.current.items.map((item) => item.id)).toEqual(["b", "a"]);

    act(() => expect(result.current.remove("b")).toBe(true));
    expect(result.current.items.map((item) => item.id)).toEqual(["a"]);
    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });

  it("rejects duplicate or invalid entries and honors the app validator", () => {
    const room = createMockRoom({ peerId: "alice" });
    const { result } = renderHook(() =>
      useSharedCollection<Task>(room, "tasks", { validate: (item) => item.title.length > 0 }),
    );

    act(() => {
      expect(result.current.add({ id: "", title: "Good", done: false })).toBe(false);
      expect(result.current.add({ id: "a", title: "", done: false })).toBe(false);
      expect(result.current.add({ id: "a", title: "Good", done: false })).toBe(true);
      expect(result.current.add({ id: "a", title: "Again", done: false })).toBe(false);
      expect(result.current.update("a", { title: "" })).toBe(false);
    });
    expect(result.current.items).toEqual([{ id: "a", title: "Good", done: false }]);
  });

  it("replicates ordered mutations to another peer", () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const a = renderHook(() => useSharedCollection<Task>(alice, "tasks"));
    const b = renderHook(() => useSharedCollection<Task>(bob, "tasks"));

    act(() => a.result.current.add({ id: "a", title: "Shared", done: false }));
    expect(b.result.current.byId("a")).toEqual({ id: "a", title: "Shared", done: false });
    act(() => b.result.current.update("a", { done: true }));
    expect(a.result.current.byId("a")?.done).toBe(true);
    unlink();
  });

  it("is inert without a room", () => {
    const { result } = renderHook(() => useSharedCollection<Task>(null, "tasks"));
    expect(result.current.items).toEqual([]);
    expect(result.current.add({ id: "a", title: "x", done: false })).toBe(false);
    expect(result.current.remove("a")).toBe(false);
  });
});
