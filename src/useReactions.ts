import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type ReactionsState = {
  /** Count map for one item, e.g. `{ up: 4, down: 1, fire: 2 }`. */
  countsFor: (itemId: string) => Record<string, number>;
  /** Net score: `up - down` (or sum if you only ever use one kind). */
  scoreOf: (itemId: string) => number;
  /** Reaction kinds this peer applied to a given item. */
  myReactionsOn: (itemId: string) => Set<string>;
  /** Apply (or replace) a single-kind reaction. Peer may only have one of each kind per item. */
  react: (itemId: string, kind: string) => void;
  /** Remove this peer's reaction of the given kind on `itemId`. */
  unreact: (itemId: string, kind: string) => void;
  /** Toggle the reaction kind on/off for this peer. */
  toggle: (itemId: string, kind: string) => void;
  /** Top-N items ranked by `scoreOf`. */
  ranked: (
    items: Array<{ id: string }>,
    limit?: number,
  ) => Array<{ id: string; score: number; counts: Record<string, number> }>;
};

type ReactionMap = Record<string, Record<string, string>>;
// Y.Map shape: itemId -> Y.Map<peerId, kind>
// We use a plain object stored at the top level for simplicity; clients are
// expected to keep item counts small.

/**
 * Many-items × many-peers × many-kinds reactions. Distinct from `useVotes`
 * (one vote per peer over one question) — this is "peer X reacted with
 * 'fire' to entry Y". Powers shower-thoughts up/down, meme-quote per-entry
 * vote, prediction-pool back/oppose, soundtrack approval.
 *
 * Storage: `Y.Map<itemId, Y.Map<peerId, kind>>`. One peer = at most one
 * reaction of each kind per item — but a peer CAN react with multiple
 * different kinds to the same item (e.g. 'fire' + 'eyes').
 *
 * Implementation note: we use a single Y.Map<string, Y.Map<string, string>>
 * — `itemId` keys hold a nested Y.Map of `peerId -> kind`. The kind set
 * for `(peer, item)` is therefore the set of nested-map values matching
 * peerId — which means a peer holding multiple kinds writes the SAME peerId
 * key once per kind via a synthetic compound key (`peerId#kind`).
 */
const ROOT_KEY_PREFIX = "__reactions:";

export function useReactions(room: YRoom | null, key: string): ReactionsState {
  const [, rerender] = useState(0);
  const yKey = `${ROOT_KEY_PREFIX}${key}`;

  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<ReactionMap[string]>(yKey);
    const cb = () => rerender((n) => n + 1);
    m.observeDeep(cb);
    return () => m.unobserveDeep(cb);
  }, [room, yKey]);

  const map = room ? room.doc.getMap<Record<string, string>>(yKey) : null;
  const myPeerId = room?.peerId ?? "";

  const itemEntries = (itemId: string): Record<string, string> => {
    if (!map) return {};
    return map.get(itemId) ?? {};
  };

  const countsFor = (itemId: string): Record<string, number> => {
    const entries = itemEntries(itemId);
    const counts: Record<string, number> = {};
    for (const v of Object.values(entries)) {
      counts[v] = (counts[v] ?? 0) + 1;
    }
    return counts;
  };

  const scoreOf = (itemId: string): number => {
    const c = countsFor(itemId);
    return (c.up ?? 0) - (c.down ?? 0);
  };

  const myReactionsOn = (itemId: string): Set<string> => {
    const out = new Set<string>();
    const entries = itemEntries(itemId);
    for (const [k, v] of Object.entries(entries)) {
      if (k === myPeerId || k.startsWith(`${myPeerId}#`)) out.add(v);
    }
    return out;
  };

  const compoundKey = (kind: string) => `${myPeerId}#${kind}`;

  const writeItem = (itemId: string, mutator: (next: Record<string, string>) => Record<string, string>) => {
    if (!map) return;
    const cur = { ...itemEntries(itemId) };
    const next = mutator(cur);
    map.set(itemId, next);
  };

  const react: ReactionsState["react"] = (itemId, kind) => {
    if (!myPeerId) return;
    writeItem(itemId, (cur) => {
      cur[compoundKey(kind)] = kind;
      return cur;
    });
  };

  const unreact: ReactionsState["unreact"] = (itemId, kind) => {
    if (!myPeerId) return;
    writeItem(itemId, (cur) => {
      delete cur[compoundKey(kind)];
      return cur;
    });
  };

  const toggle: ReactionsState["toggle"] = (itemId, kind) => {
    if (myReactionsOn(itemId).has(kind)) unreact(itemId, kind);
    else react(itemId, kind);
  };

  const ranked: ReactionsState["ranked"] = (items, limit = items.length) =>
    items
      .map((it) => ({ id: it.id, score: scoreOf(it.id), counts: countsFor(it.id) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  return { countsFor, scoreOf, myReactionsOn, react, unreact, toggle, ranked };
}
