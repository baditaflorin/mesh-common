import * as Y from "yjs";
import type { YRoom } from "../src/useYRoom";

/**
 * Returns a YRoom-shaped object backed by an in-memory Y.Doc, with no
 * WebrtcProvider. Use this in Vitest component tests so `Feature` can be
 * rendered without any network.
 *
 * To simulate two peers in unit tests, create two mock rooms and call
 * `linkMockRooms(a, b)` to relay updates between them in-process.
 */
export function createMockRoom(overrides: Partial<YRoom> = {}): YRoom {
  return {
    doc: new Y.Doc(),
    provider: null,
    peerId: overrides.peerId ?? `mock-${Math.random().toString(36).slice(2, 8)}`,
    peerCount: overrides.peerCount ?? 0,
    roomId: overrides.roomId ?? "mock-room",
    ...overrides,
  };
}

/**
 * Wire two mock rooms together via update relay. Yjs updates from `a.doc`
 * are applied to `b.doc` and vice versa. Useful for testing mesh sync logic
 * deterministically and synchronously.
 */
export function linkMockRooms(a: YRoom, b: YRoom): () => void {
  const onA = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    Y.applyUpdate(b.doc, update, "remote");
  };
  const onB = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    Y.applyUpdate(a.doc, update, "remote");
  };
  a.doc.on("update", onA);
  b.doc.on("update", onB);
  return () => {
    a.doc.off("update", onA);
    b.doc.off("update", onB);
  };
}
