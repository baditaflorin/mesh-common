import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createMockRoom, linkMockRooms } from "../testing/createMockRoom";

describe("createMockRoom", () => {
  it("returns a room with an empty Y.Doc and no provider", () => {
    const room = createMockRoom();
    expect(room.doc).toBeInstanceOf(Y.Doc);
    expect(room.provider).toBeNull();
    expect(room.peerCount).toBe(0);
    expect(room.peerId).toMatch(/^mock-[a-z0-9]+$/);
  });

  it("respects overrides", () => {
    const room = createMockRoom({ peerId: "fixed", peerCount: 3 });
    expect(room.peerId).toBe("fixed");
    expect(room.peerCount).toBe(3);
  });
});

describe("linkMockRooms", () => {
  it("relays Yjs updates between two rooms in-process", () => {
    const a = createMockRoom();
    const b = createMockRoom();
    const unlink = linkMockRooms(a, b);

    a.doc.getMap("votes").set("alice", true);
    expect(b.doc.getMap("votes").get("alice")).toBe(true);

    b.doc.getArray("notes").push(["hello"]);
    expect(a.doc.getArray("notes").toArray()).toEqual(["hello"]);

    unlink();

    a.doc.getMap("votes").set("bob", false);
    expect(b.doc.getMap("votes").get("bob")).toBeUndefined();
  });

  it("does not loop infinitely when echoing updates", () => {
    const a = createMockRoom();
    const b = createMockRoom();
    linkMockRooms(a, b);
    for (let i = 0; i < 10; i++) {
      a.doc.getArray("nums").push([i]);
    }
    expect(b.doc.getArray("nums").toArray()).toHaveLength(10);
  });
});
