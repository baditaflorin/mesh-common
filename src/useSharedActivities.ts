import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

function useActivityVersion(room: YRoom | null, key: string, array = false) {
  const [, render] = useState(0);
  useEffect(() => {
    if (!room) return;
    const type = array ? room.doc.getArray(key) : room.doc.getMap(key);
    const update = () => render((n) => n + 1);
    type.observe(update);
    return () => type.unobserve(update);
  }, [room, key, array]);
}

export type SharedPairing = { id: string; peers: string[] };
export function useSharedPairings(room: YRoom | null, key = "pairings") {
  useActivityVersion(room, key, true);
  const list = room?.doc.getArray<SharedPairing>(key);
  const pairings =
    list
      ?.toArray()
      .filter(
        (pair) =>
          pair?.id && Array.isArray(pair.peers) && pair.peers.length > 0,
      ) ?? [];
  return {
    pairings,
    set: (next: SharedPairing[]) => {
      if (
        !list ||
        next.some(
          (pair) => !pair.id || pair.peers.length < 1 || pair.peers.length > 4,
        )
      )
        return false;
      list.delete(0, list.length);
      list.push(
        next.map((pair) => ({
          id: pair.id,
          peers: [...new Set(pair.peers)].sort(),
        })),
      );
      return true;
    },
    clear: () => {
      if (!list) return false;
      list.delete(0, list.length);
      return true;
    },
  };
}

export function useSharedTurnOrder(room: YRoom | null, key = "turn-order") {
  useActivityVersion(room, key);
  const map = room?.doc.getMap<string | number>(key);
  let peers: string[] = [];
  try {
    const saved = map?.get("peers");
    const parsed = typeof saved === "string" ? JSON.parse(saved) : [];
    peers =
      Array.isArray(parsed) && parsed.every((peer) => typeof peer === "string")
        ? parsed
        : [];
  } catch {
    peers = [];
  }
  const index = Number(map?.get("index") ?? 0);
  return {
    peers,
    current: peers[index] ?? null,
    index,
    setPeers: (next: string[]) => {
      if (!map || !next.length || next.some((peer) => !peer)) return false;
      map.set("peers", JSON.stringify([...new Set(next)]));
      map.set("index", 0);
      return true;
    },
    next: () => {
      if (!map) return false;
      let currentPeers = peers;
      try {
        const saved = map.get("peers");
        const parsed = typeof saved === "string" ? JSON.parse(saved) : [];
        if (
          Array.isArray(parsed) &&
          parsed.every((peer) => typeof peer === "string")
        )
          currentPeers = parsed;
      } catch {}
      if (!currentPeers.length) return false;
      map.set(
        "index",
        (Number(map.get("index") ?? index) + 1) % currentPeers.length,
      );
      return true;
    },
  };
}

export function useSharedBudget(room: YRoom | null, key = "budget") {
  useActivityVersion(room, key);
  const map = room?.doc.getMap<number>(key);
  const contributions = [...(map?.entries() ?? [])].flatMap(
    ([peerId, amount]) =>
      typeof amount === "number" && Number.isFinite(amount) && amount >= 0
        ? [{ peerId, amount }]
        : [],
  );
  const total = contributions.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    contributions,
    total,
    setMine: (amount: number) => {
      if (
        !room ||
        !map ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 1_000_000
      )
        return false;
      map.set(room.peerId, Math.round(amount * 100) / 100);
      return true;
    },
    clear: () => {
      if (!map) return false;
      map.clear();
      return true;
    },
  };
}

export type SharedCard = { id: string; label: string; flipped: boolean };
export function useSharedCardStack(room: YRoom | null, key = "cards") {
  useActivityVersion(room, key, true);
  const list = room?.doc.getArray<SharedCard>(key);
  const cards =
    list
      ?.toArray()
      .filter(
        (card) => card?.id && card.label && typeof card.flipped === "boolean",
      ) ?? [];
  return {
    cards,
    add: (label: string, id = `${room?.peerId ?? "local"}-${Date.now()}`) => {
      const clean = label.trim();
      if (
        !list ||
        !clean ||
        clean.length > 120 ||
        cards.some((card) => card.id === id)
      )
        return false;
      list.push([{ id, label: clean, flipped: false }]);
      return true;
    },
    flip: (id: string) => {
      if (!list) return false;
      const index = cards.findIndex((card) => card.id === id);
      if (index < 0) return false;
      const card = cards[index];
      if (!card) return false;
      list.delete(index, 1);
      list.insert(index, [{ ...card, flipped: !card.flipped }]);
      return true;
    },
  };
}

export type SharedHost = { peerId: string; claimedAt: number };
export function useSharedHost(room: YRoom | null, key = "host") {
  useActivityVersion(room, key);
  const map = room?.doc.getMap<SharedHost>(key);
  const host = map?.get("current") ?? null;
  return {
    host,
    claim: () => {
      if (!room || !map || host) return false;
      map.set("current", { peerId: room.peerId, claimedAt: Date.now() });
      return true;
    },
    release: () => {
      if (!room || !map || host?.peerId !== room.peerId) return false;
      map.delete("current");
      return true;
    },
  };
}
