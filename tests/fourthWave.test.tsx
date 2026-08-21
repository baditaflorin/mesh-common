// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";
import { useCrdtMigrations } from "../src/useCrdtMigrations";
import { useSharedCounter } from "../src/useSharedCounter";
import { useSharedSearchIndex } from "../src/useSharedSearchIndex";
import { useSharedSet } from "../src/useSharedSet";
import { useSharedTagIndex } from "../src/useSharedTagIndex";

describe("fourth primitive wave", () => {
  it("replicates validated shared-set membership and peer-attributed counters", () => {
    const alice = createMockRoom({ peerId: "alice" });
    const bob = createMockRoom({ peerId: "bob" });
    const unlink = linkMockRooms(alice, bob);
    const aSet = renderHook(() => useSharedSet(alice, "topics", { validate: (value) => value.length > 1 }));
    const bSet = renderHook(() => useSharedSet(bob, "topics"));
    const aCounter = renderHook(() => useSharedCounter(alice, "score", { min: 0, max: 3 }));
    const bCounter = renderHook(() => useSharedCounter(bob, "score", { min: 0, max: 3 }));

    act(() => {
      expect(aSet.result.current.add("ux")).toBe(true);
      expect(aSet.result.current.add("x")).toBe(false);
      expect(aCounter.result.current.increment(2)).toBe(true);
      expect(bCounter.result.current.increment()).toBe(true);
    });
    expect(bSet.result.current.values).toEqual(["ux"]);
    expect(aCounter.result.current.value).toBe(3);
    expect(aCounter.result.current.byPeer).toEqual({ alice: 2, bob: 1 });
    act(() => expect(bCounter.result.current.increment()).toBe(false));
    unlink();
  });

  it("runs contiguous schema migrations once and reports a missing step", () => {
    const room = createMockRoom({ peerId: "alice" });
    const migration = renderHook(() => useCrdtMigrations(room, "board", [
      { version: 1, migrate: (doc) => doc.getMap<string>("board:data").set("title", "Ready") },
      { version: 2, migrate: (doc) => doc.getMap<string>("board:data").set("status", "live") },
    ]));
    act(() => expect(migration.result.current.migrate()).toBe(true));
    expect(migration.result.current.version).toBe(2);
    expect(room.doc.getMap<string>("board:data").toJSON()).toEqual({ title: "Ready", status: "live" });
    const missing = renderHook(() => useCrdtMigrations(room, "other", [{ version: 2, migrate: () => undefined }]));
    act(() => expect(missing.result.current.migrate()).toBe(false));
    expect(missing.result.current.error?.message).toMatch(/Missing CRDT migration/);
  });

  it("derives search and tag indexes without duplicating shared collection state", () => {
    const items = [
      { title: "Ship map", tags: ["Maps", "local"] },
      { title: "Write guide", tags: ["docs"] },
      { title: "Map legend", tags: ["maps", "docs"] },
    ];
    const search = renderHook(() => useSharedSearchIndex(items, { getText: (item) => item.title }));
    const tags = renderHook(() => useSharedTagIndex(items, { getTags: (item) => item.tags }));
    act(() => search.result.current.setQuery("map"));
    expect(search.result.current.results.map((item) => item.title)).toEqual(["Ship map", "Map legend"]);
    expect(tags.result.current.counts).toEqual({ maps: 2, local: 1, docs: 2 });
    act(() => tags.result.current.setFilter(["maps", "docs"]));
    expect(tags.result.current.results.map((item) => item.title)).toEqual(["Map legend"]);
  });
});
