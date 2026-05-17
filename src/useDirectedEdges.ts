import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type Edge = {
  from: string;
  to: string;
  ts: number;
  label?: string;
};

/**
 * Returns a snapshot of all directed edges (a `Y.Array<Edge>`) plus helpers to
 * add or remove edges. Edges are deduplicated by `(from, to)` — adding an edge
 * that already exists is a no-op.
 */
export function useDirectedEdges(room: YRoom | null, key = "edges") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<Edge>(key);
    const onChange = () => rerender((n) => n + 1);
    arr.observe(onChange);
    return () => arr.unobserve(onChange);
  }, [room, key]);

  const arr = room ? room.doc.getArray<Edge>(key) : null;
  const edges = arr ? arr.toArray() : [];

  const has = (from: string, to: string) =>
    edges.some((e) => e.from === from && e.to === to);

  const add = (from: string, to: string, label?: string) => {
    if (!arr || !room) return;
    if (has(from, to)) return;
    arr.push([{ from, to, ts: Date.now(), label }]);
  };

  const remove = (from: string, to: string) => {
    if (!arr || !room) return;
    const idx = arr.toArray().findIndex((e) => e.from === from && e.to === to);
    if (idx >= 0) arr.delete(idx, 1);
  };

  const adjacencyOut = new Map<string, Edge[]>();
  const adjacencyIn = new Map<string, Edge[]>();
  for (const e of edges) {
    const outList = adjacencyOut.get(e.from) ?? [];
    outList.push(e);
    adjacencyOut.set(e.from, outList);
    const inList = adjacencyIn.get(e.to) ?? [];
    inList.push(e);
    adjacencyIn.set(e.to, inList);
  }

  return { edges, add, remove, has, adjacencyOut, adjacencyIn };
}

/** Breadth-first shortest path from `start` to `goal` using directed edges. */
export function shortestPath(edges: Edge[], start: string, goal: string): string[] | null {
  if (start === goal) return [start];
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  const prev = new Map<string, string>();
  const visited = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === goal) {
      const path: string[] = [goal];
      let n = goal;
      while (prev.has(n)) {
        n = prev.get(n)!;
        path.unshift(n);
      }
      return path;
    }
    for (const nb of adj.get(cur) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  return null;
}

/** Longest simple path through a (potentially cyclic) directed graph, by DFS. */
export function longestSimplePath(edges: Edge[]): string[] {
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  let best: string[] = [];
  const dfs = (cur: string, path: string[], visited: Set<string>) => {
    if (path.length > best.length) best = path.slice();
    for (const nb of adj.get(cur) ?? []) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      path.push(nb);
      dfs(nb, path, visited);
      path.pop();
      visited.delete(nb);
    }
  };
  for (const start of nodes) {
    dfs(start, [start], new Set([start]));
    if (best.length === nodes.size) return best;
  }
  return best;
}
