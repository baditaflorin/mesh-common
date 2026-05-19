// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";
import { useThreadedMessages } from "../src/useThreadedMessages";

function room(peerId: string, doc: Y.Doc = new Y.Doc()): YRoom {
  return { doc, provider: null, peerId, peerCount: 0, roomId: "test" };
}

describe("useThreadedMessages", () => {
  it("posts a top-level message", () => {
    const r = room("alice");
    const { result } = renderHook(() => useThreadedMessages<string>(r));
    act(() => result.current.post({ id: "m1", body: "hello", by: "alice", at: 100 }));
    expect(result.current.flat).toHaveLength(1);
    expect(result.current.flat[0]?.id).toBe("m1");
    expect(result.current.flat[0]?.body).toBe("hello");
    expect(result.current.flat[0]?.parent).toBeUndefined();
  });

  it("replies attach to parents and flatten depth-first", () => {
    const r = room("alice");
    const { result } = renderHook(() => useThreadedMessages<string>(r));
    act(() => {
      result.current.post({ id: "m1", body: "root", by: "alice", at: 100 });
      result.current.reply("m1", { id: "m2", body: "reply-1", by: "bob", at: 200 });
      result.current.reply("m2", { id: "m3", body: "reply-1.1", by: "alice", at: 300 });
      result.current.reply("m1", { id: "m4", body: "reply-2", by: "carol", at: 400 });
      result.current.post({ id: "m5", body: "another root", by: "bob", at: 500 });
    });
    expect(result.current.threads.map((t) => [t.node.id, t.depth])).toEqual([
      ["m1", 0],
      ["m2", 1],
      ["m3", 2],
      ["m4", 1],
      ["m5", 0],
    ]);
  });

  it("repliesOf returns direct children only", () => {
    const r = room("alice");
    const { result } = renderHook(() => useThreadedMessages<string>(r));
    act(() => {
      result.current.post({ id: "m1", body: "root", by: "alice", at: 100 });
      result.current.reply("m1", { id: "m2", body: "a", by: "bob", at: 200 });
      result.current.reply("m2", { id: "m3", body: "deeper", by: "carol", at: 300 });
    });
    expect(result.current.repliesOf("m1").map((m) => m.id)).toEqual(["m2"]);
  });

  it("post is idempotent on duplicate ids", () => {
    const r = room("alice");
    const { result } = renderHook(() => useThreadedMessages<string>(r));
    act(() => {
      result.current.post({ id: "m1", body: "first", by: "alice", at: 100 });
      result.current.post({ id: "m1", body: "second", by: "bob", at: 200 });
    });
    expect(result.current.flat).toHaveLength(1);
    expect(result.current.flat[0]?.body).toBe("first");
  });

  it("remove drops the message; replies become orphans", () => {
    const r = room("alice");
    const { result } = renderHook(() => useThreadedMessages<string>(r));
    act(() => {
      result.current.post({ id: "m1", body: "root", by: "alice", at: 100 });
      result.current.reply("m1", { id: "m2", body: "child", by: "bob", at: 200 });
    });
    act(() => result.current.remove("m1"));
    expect(result.current.flat).toHaveLength(1);
    expect(result.current.flat[0]?.id).toBe("m2");
    // m2 still references missing parent — that's intentional, callers can re-parent or filter.
    expect(result.current.flat[0]?.parent).toBe("m1");
  });

  it("byId finds messages O(n)", () => {
    const r = room("alice");
    const { result } = renderHook(() => useThreadedMessages<string>(r));
    act(() => result.current.post({ id: "m1", body: "hi", by: "alice", at: 100 }));
    expect(result.current.byId("m1")?.body).toBe("hi");
    expect(result.current.byId("nope")).toBeUndefined();
  });
});
