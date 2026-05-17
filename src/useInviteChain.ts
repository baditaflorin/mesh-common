import { useEffect, useState } from "react";
import type { MeshConfig } from "./MeshConfig";
import type { YRoom } from "./useYRoom";
import { useIncomingScanLink } from "./useIncomingScanLink";

export type InviteEdge = {
  /** Inviter peer id. */
  from: string;
  /** Receiver peer id. */
  to: string;
  ts: number;
};

export type InviteChainState = {
  /** All edges recorded in the room's `__mesh_invites` Y.Array. */
  edges: InviteEdge[];
  /** Peers reachable downstream from this peer (transitive subtree). */
  mySubtree: string[];
  /** Number of hops from a chain root to this peer (0 = root / direct join). */
  myDepth: number;
  /** Number of peers this peer has directly invited. */
  myDirectInvites: number;
};

/**
 * Universal invite-graph hook. On first page-load where a `#p=<inviter>` deep
 * link was consumed via `useIncomingScanLink`, append an edge `(inviter, me)`
 * to a shared `__mesh_invites` Y.Array (deduplicated). Every app inherits the
 * same chain — visualizer apps (mesh-snowball) read it; others just propagate.
 *
 * Safe no-op when `room` is null or when no deep-link is present.
 */
export function useInviteChain(room: YRoom | null, config: MeshConfig): InviteChainState {
  const incoming = useIncomingScanLink(config);
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<InviteEdge>("__mesh_invites");
    const cb = () => rerender((n) => n + 1);
    arr.observe(cb);
    return () => arr.unobserve(cb);
  }, [room]);

  useEffect(() => {
    if (!room || !incoming?.peerId) return;
    const inviter = incoming.peerId;
    if (inviter === room.peerId) return;
    const arr = room.doc.getArray<InviteEdge>("__mesh_invites");
    const existing = arr.toArray();
    if (existing.some((e) => e.from === inviter && e.to === room.peerId)) return;
    arr.push([{ from: inviter, to: room.peerId, ts: Date.now() }]);
  }, [room, incoming?.peerId]);

  const edges = room ? room.doc.getArray<InviteEdge>("__mesh_invites").toArray() : [];
  const me = room?.peerId ?? "";

  const out = new Map<string, string[]>();
  const inMap = new Map<string, string>();
  for (const e of edges) {
    const list = out.get(e.from) ?? [];
    list.push(e.to);
    out.set(e.from, list);
    inMap.set(e.to, e.from);
  }

  const mySubtree: string[] = [];
  const visited = new Set<string>([me]);
  const queue: string[] = [me];
  while (queue.length > 0) {
    const n = queue.shift() as string;
    for (const child of out.get(n) ?? []) {
      if (visited.has(child)) continue;
      visited.add(child);
      mySubtree.push(child);
      queue.push(child);
    }
  }

  let myDepth = 0;
  let cur: string | undefined = me;
  const seen = new Set<string>([me]);
  while (cur && inMap.has(cur)) {
    const parent = inMap.get(cur);
    if (!parent || seen.has(parent)) break;
    seen.add(parent);
    cur = parent;
    myDepth++;
    if (myDepth > 1000) break;
  }

  const myDirectInvites = out.get(me)?.length ?? 0;

  return { edges, mySubtree, myDepth, myDirectInvites };
}
