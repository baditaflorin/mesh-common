// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { z } from "zod";
import { createMockRoom } from "../testing/createMockRoom";
import { useTypedMap, useTypedArray, defineFeatureContract } from "../src/featureContract";

describe("defineFeatureContract", () => {
  it("is a typed identity wrapper", () => {
    const c = defineFeatureContract({
      a: z.string(),
      b: z.object({ n: z.number() }),
    });
    expect(c.a).toBeDefined();
    expect(c.b).toBeDefined();
  });
});

describe("useTypedMap", () => {
  const ballot = z.object({ vote: z.enum(["yes", "no"]), round: z.number() });

  it("validates writes via .set", () => {
    const room = createMockRoom();
    const { result } = renderHook(() => useTypedMap(room, "b", ballot));
    act(() => result.current.set("alice", { vote: "yes", round: 1 }));
    expect(result.current.get("alice")).toEqual({ vote: "yes", round: 1 });
    expect(() => result.current.set("bob", { vote: "maybe" } as never)).toThrow();
  });

  it("safeSet returns ok / error without throwing", () => {
    const room = createMockRoom();
    const { result } = renderHook(() => useTypedMap(room, "b", ballot));
    act(() => {
      const r = result.current.safeSet("alice", { vote: "weird" });
      expect(r.ok).toBe(false);
    });
    act(() => {
      const r = result.current.safeSet("alice", { vote: "no", round: 2 });
      expect(r.ok).toBe(true);
    });
    expect(result.current.get("alice")).toEqual({ vote: "no", round: 2 });
  });

  it("filters out invalid entries written by a hostile/old peer", () => {
    const room = createMockRoom();
    const onInvalid = vi.fn();
    // Bypass validation by writing directly to the underlying Y.Map.
    room.doc.getMap<unknown>("b").set("malicious", { vote: "junk" });
    room.doc.getMap<unknown>("b").set("good", { vote: "yes", round: 1 });
    const { result } = renderHook(() => useTypedMap(room, "b", ballot, { onInvalid }));
    expect(result.current.size).toBe(1);
    expect(result.current.keys()).toEqual(["good"]);
    expect(result.current.lastInvalid.malicious).toMatch(/vote/);
    expect(onInvalid).toHaveBeenCalledWith("malicious", expect.any(String), expect.anything());
  });

  it("re-renders when underlying map changes", () => {
    const room = createMockRoom();
    const { result } = renderHook(() => useTypedMap(room, "b", ballot));
    expect(result.current.size).toBe(0);
    act(() => {
      room.doc.getMap<unknown>("b").set("c", { vote: "yes", round: 1 });
    });
    expect(result.current.size).toBe(1);
  });
});

describe("useTypedArray", () => {
  const log = z.object({ msg: z.string(), at: z.number() });

  it("filters and reports invalid items by index", () => {
    const room = createMockRoom();
    const arr = room.doc.getArray<unknown>("log");
    arr.push([{ msg: "first", at: 1 }, { broken: true }, { msg: "third", at: 3 }]);
    const { result } = renderHook(() => useTypedArray(room, "log", log));
    expect(result.current.size).toBe(2);
    expect(result.current.items[0]?.msg).toBe("first");
    expect(result.current.items[1]?.msg).toBe("third");
    expect(result.current.lastInvalid).toEqual([{ index: 1, error: expect.any(String) }]);
  });

  it("push validates", () => {
    const room = createMockRoom();
    const { result } = renderHook(() => useTypedArray(room, "log", log));
    expect(() => result.current.push({ msg: "ok", at: 2 })).not.toThrow();
    expect(() => result.current.push({ msg: 1 } as never)).toThrow();
  });
});
