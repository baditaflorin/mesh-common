// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";
import { useFileShare } from "../src/useFileShare";

function makeRoom(peerId: string, doc: Y.Doc = new Y.Doc()): YRoom {
  return { doc, provider: null, peerId, peerCount: 0, roomId: "test" };
}

function bytesBlob(bytes: number[], mime = "application/octet-stream"): Blob {
  return new Blob([new Uint8Array(bytes)], { type: mime });
}

describe("useFileShare", () => {
  it("starts empty when room is null", () => {
    const { result } = renderHook(() => useFileShare(null));
    expect(result.current.files).toEqual([]);
  });

  it("sends a small file and reports complete", async () => {
    const room = makeRoom("alice");
    const { result } = renderHook(() => useFileShare(room));
    let id = "";
    await act(async () => {
      id = await result.current.send(bytesBlob([1, 2, 3, 4, 5], "text/plain"), { name: "hi.txt" });
    });
    await waitFor(() => expect(result.current.files.length).toBe(1));
    const f = result.current.files[0]!;
    expect(f.id).toBe(id);
    expect(f.manifest.name).toBe("hi.txt");
    expect(f.manifest.size).toBe(5);
    expect(f.complete).toBe(true);
  });

  it("chunks a multi-chunk file", async () => {
    const room = makeRoom("alice");
    const { result } = renderHook(() => useFileShare(room, { chunkBytes: 4 }));
    const buf = new Array(15).fill(0).map((_, i) => i + 1);
    await act(async () => {
      await result.current.send(bytesBlob(buf), { id: "f1" });
    });
    await waitFor(() => expect(result.current.files.length).toBe(1));
    expect(result.current.files[0]?.manifest.chunks).toBe(4);
    expect(result.current.files[0]?.complete).toBe(true);
  });

  it("rejects files larger than maxBytes", async () => {
    const room = makeRoom("alice");
    const { result } = renderHook(() => useFileShare(room, { maxBytes: 10 }));
    await expect(
      act(async () => {
        await result.current.send(bytesBlob(new Array(20).fill(0)));
      }),
    ).rejects.toThrow(/too large/);
  });

  it("blobOf reassembles the original bytes", async () => {
    const room = makeRoom("alice");
    const { result } = renderHook(() => useFileShare(room, { chunkBytes: 3 }));
    const original = [10, 20, 30, 40, 50, 60, 70];
    let id = "";
    await act(async () => {
      id = await result.current.send(bytesBlob(original, "text/plain"));
    });
    await waitFor(() => expect(result.current.files[0]?.complete).toBe(true));
    const blob = await result.current.blobOf(id);
    expect(blob).not.toBeNull();
    expect(blob!.size).toBe(original.length);
    const got = new Uint8Array(await blob!.arrayBuffer());
    expect(Array.from(got)).toEqual(original);
  });

  it("remove drops the file", async () => {
    const room = makeRoom("alice");
    const { result } = renderHook(() => useFileShare(room));
    let id = "";
    await act(async () => {
      id = await result.current.send(bytesBlob([1, 2, 3]));
    });
    await waitFor(() => expect(result.current.files.length).toBe(1));
    act(() => result.current.remove(id));
    await waitFor(() => expect(result.current.files.length).toBe(0));
  });
});
