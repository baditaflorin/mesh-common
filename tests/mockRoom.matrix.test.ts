import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

/**
 * Matrix tests for the in-memory mesh harness. Apps use this to write
 * synchronous, deterministic two-peer tests in Vitest (no Playwright).
 */

describe.each([
  ["Y.Map<string,string>", "items", () => new Map<string, string>()],
  ["Y.Map<string,boolean>", "votes", () => new Map<string, boolean>()],
])("linkMockRooms relays %s edits", (_label, mapKey) => {
  it("a→b", () => {
    const a = createMockRoom();
    const b = createMockRoom();
    linkMockRooms(a, b);
    a.doc.getMap(mapKey).set("k", "v");
    expect(b.doc.getMap(mapKey).get("k")).toBe("v");
  });

  it("b→a", () => {
    const a = createMockRoom();
    const b = createMockRoom();
    linkMockRooms(a, b);
    b.doc.getMap(mapKey).set("k2", "v2");
    expect(a.doc.getMap(mapKey).get("k2")).toBe("v2");
  });
});

describe("linkMockRooms with Y.Array", () => {
  it.each([
    ["push", (arr: Y.Array<number>) => arr.push([1, 2, 3])],
    ["insert at 0", (arr: Y.Array<number>) => arr.insert(0, [99])],
    ["delete range", (arr: Y.Array<number>) => {
      arr.push([1, 2, 3, 4, 5]);
      arr.delete(1, 2);
    }],
  ])("relays %s", (_label, op) => {
    const a = createMockRoom();
    const b = createMockRoom();
    linkMockRooms(a, b);
    op(a.doc.getArray<number>("nums"));
    expect(b.doc.getArray<number>("nums").toArray()).toEqual(
      a.doc.getArray<number>("nums").toArray(),
    );
  });
});

describe("linkMockRooms — concurrent edits converge (CRDT)", () => {
  it("two peers writing different keys both end up with both keys", () => {
    const a = createMockRoom();
    const b = createMockRoom();
    linkMockRooms(a, b);
    a.doc.getMap("m").set("a-only", 1);
    b.doc.getMap("m").set("b-only", 2);
    expect(a.doc.getMap("m").get("a-only")).toBe(1);
    expect(a.doc.getMap("m").get("b-only")).toBe(2);
    expect(b.doc.getMap("m").get("a-only")).toBe(1);
    expect(b.doc.getMap("m").get("b-only")).toBe(2);
  });

  it("last-writer-wins on same key (Yjs Y.Map semantics)", () => {
    const a = createMockRoom();
    const b = createMockRoom();
    linkMockRooms(a, b);
    a.doc.getMap("m").set("k", "from-a");
    b.doc.getMap("m").set("k", "from-b");
    // Both peers converge to the same final value (one of the two).
    expect(a.doc.getMap("m").get("k")).toBe(b.doc.getMap("m").get("k"));
  });
});

describe("linkMockRooms unlink", () => {
  it("stops relay after returned cleanup is called", () => {
    const a = createMockRoom();
    const b = createMockRoom();
    const unlink = linkMockRooms(a, b);
    a.doc.getMap("m").set("first", 1);
    expect(b.doc.getMap("m").get("first")).toBe(1);
    unlink();
    a.doc.getMap("m").set("second", 2);
    expect(b.doc.getMap("m").get("second")).toBeUndefined();
  });
});

describe("createMockRoom — overrides matrix", () => {
  it.each([
    ["explicit peerId", { peerId: "custom-id" }, "peerId", "custom-id"],
    ["explicit peerCount=5", { peerCount: 5 }, "peerCount", 5],
    ["explicit peerCount=0", { peerCount: 0 }, "peerCount", 0],
  ])("%s", (_label, overrides, prop, expected) => {
    const room = createMockRoom(overrides as Parameters<typeof createMockRoom>[0]);
    expect(room[prop as keyof typeof room]).toBe(expected);
  });
});
