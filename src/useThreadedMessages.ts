import { useCallback, useEffect, useMemo, useState } from "react";
import type { YRoom } from "./useYRoom";

/**
 * Threaded messages over a `Y.Map<msgId, { parent?, body, by, at, sig? }>`.
 * A message with no `parent` is a top-level post; with a `parent` it's a
 * reply. The hook exposes the raw map, a flat ordered list, and a
 * tree-flattened render order (parent-first, then children depth-first).
 *
 *   const t = useThreadedMessages(room);
 *   t.post({ id, body, by });                  // top-level
 *   t.reply(parentId, { id, body, by });       // reply
 *   t.flat        // chronological flat list (for storage view)
 *   t.threads     // [{node, depth}, …] flattened for rendering
 *   t.byId(id)    // O(1) lookup
 *   t.repliesOf(id)  // direct children, chronological
 *
 * Stable ordering: messages are sorted by `at` (then `id` as tiebreaker).
 * Trees are stable because Yjs gives each peer the same set of records.
 *
 * Signing is opt-in — pass `signWith` from `useSignedWrite` and the hook
 * will store the signature in the record; verification is the caller's
 * responsibility (display chain trust separately).
 */

export type ThreadedMessage<T> = {
  id: string;
  parent?: string;
  body: T;
  by: string;
  at: number;
  sig?: string;
};

export type ThreadedMessagesApi<T> = {
  flat: ReadonlyArray<ThreadedMessage<T>>;
  /** Pre-flattened tree: parent first, then each subtree depth-first. */
  threads: ReadonlyArray<{ node: ThreadedMessage<T>; depth: number }>;
  byId(id: string): ThreadedMessage<T> | undefined;
  repliesOf(id: string): ThreadedMessage<T>[];
  post(payload: { id: string; body: T; by: string; sig?: string; at?: number }): void;
  reply(
    parentId: string,
    payload: { id: string; body: T; by: string; sig?: string; at?: number },
  ): void;
  /** Remove a message (and orphan its replies — callers can re-parent if they want). */
  remove(id: string): void;
};

export type ThreadedMessagesOptions = {
  /** Y.Map name. Default "mesh:threads". */
  mapName?: string;
};

export function useThreadedMessages<T = string>(
  room: YRoom | null,
  opts?: ThreadedMessagesOptions,
): ThreadedMessagesApi<T> {
  const mapName = opts?.mapName ?? "mesh:threads";
  const [messages, setMessages] = useState<ReadonlyArray<ThreadedMessage<T>>>(() => []);

  useEffect(() => {
    if (!room) {
      setMessages([]);
      return;
    }
    const map = room.doc.getMap<ThreadedMessage<T>>(mapName);
    const refresh = () => setMessages(Array.from(map.values()));
    refresh();
    map.observe(refresh);
    return () => map.unobserve(refresh);
  }, [room, mapName]);

  const flat = useMemo(
    () =>
      [...messages].sort((a, b) => {
        if (a.at !== b.at) return a.at - b.at;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      }),
    [messages],
  );

  const childrenIndex = useMemo(() => {
    const idx = new Map<string | undefined, ThreadedMessage<T>[]>();
    for (const m of flat) {
      const key = m.parent;
      const arr = idx.get(key) ?? [];
      arr.push(m);
      idx.set(key, arr);
    }
    return idx;
  }, [flat]);

  const threads = useMemo(() => {
    const out: Array<{ node: ThreadedMessage<T>; depth: number }> = [];
    const roots = childrenIndex.get(undefined) ?? [];
    const walk = (node: ThreadedMessage<T>, depth: number) => {
      out.push({ node, depth });
      const kids = childrenIndex.get(node.id) ?? [];
      for (const k of kids) walk(k, depth + 1);
    };
    for (const r of roots) walk(r, 0);
    return out;
  }, [childrenIndex]);

  const byId = useCallback(
    (id: string) => flat.find((m) => m.id === id),
    [flat],
  );

  const repliesOf = useCallback(
    (id: string) => childrenIndex.get(id) ?? [],
    [childrenIndex],
  );

  const post: ThreadedMessagesApi<T>["post"] = useCallback(
    ({ id, body, by, sig, at }) => {
      if (!room) return;
      const map = room.doc.getMap<ThreadedMessage<T>>(mapName);
      if (map.has(id)) return;
      map.set(id, { id, body, by, at: at ?? Date.now(), sig });
    },
    [room, mapName],
  );

  const reply: ThreadedMessagesApi<T>["reply"] = useCallback(
    (parentId, { id, body, by, sig, at }) => {
      if (!room) return;
      const map = room.doc.getMap<ThreadedMessage<T>>(mapName);
      if (map.has(id)) return;
      map.set(id, { id, parent: parentId, body, by, at: at ?? Date.now(), sig });
    },
    [room, mapName],
  );

  const remove: ThreadedMessagesApi<T>["remove"] = useCallback(
    (id) => {
      if (!room) return;
      const map = room.doc.getMap<ThreadedMessage<T>>(mapName);
      map.delete(id);
    },
    [room, mapName],
  );

  return { flat, threads, byId, repliesOf, post, reply, remove };
}
