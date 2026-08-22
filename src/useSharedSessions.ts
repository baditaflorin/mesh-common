import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

function useSharedVersion(
  room: YRoom | null,
  key: string,
  kind: "map" | "array",
) {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const value =
      kind === "map" ? room.doc.getMap(key) : room.doc.getArray(key);
    const update = () => rerender((version) => version + 1);
    value.observe(update);
    return () => value.unobserve(update);
  }, [room, key, kind]);
}

export type SharedPollOption = { id: string; label: string };
export function useSharedPoll(room: YRoom | null, key = "poll") {
  useSharedVersion(room, key, "map");
  const map = room?.doc.getMap<string>(key);
  const votes = [...(map?.entries() ?? [])]
    .filter(([, optionId]) => typeof optionId === "string")
    .map(([peerId, optionId]) => ({ peerId, optionId }));
  return {
    votes,
    vote: (optionId: string, options: SharedPollOption[]) => {
      if (!room || !map || !options.some((option) => option.id === optionId))
        return false;
      map.set(room.peerId, optionId);
      return true;
    },
    clearMine: () => {
      if (!room || !map) return false;
      map.delete(room.peerId);
      return true;
    },
    clear: () => {
      if (!map) return false;
      map.clear();
      return true;
    },
  };
}

export type SharedRoleClaim = {
  role: string;
  peerId: string;
  claimedAt: number;
};
export function useSharedRoles(room: YRoom | null, key = "roles") {
  useSharedVersion(room, key, "map");
  const map = room?.doc.getMap<SharedRoleClaim>(key);
  const claims = [...(map?.entries() ?? [])]
    .flatMap(([role, claim]) =>
      claim && claim.peerId && claim.role === role ? [claim] : [],
    )
    .sort((a, b) => a.role.localeCompare(b.role));
  return {
    claims,
    claim: (role: string) => {
      const clean = role.trim();
      if (!room || !map || !clean || clean.length > 80 || map.has(clean))
        return false;
      map.set(clean, {
        role: clean,
        peerId: room.peerId,
        claimedAt: Date.now(),
      });
      return true;
    },
    release: (role: string) => {
      if (!room || !map || map.get(role)?.peerId !== room.peerId) return false;
      map.delete(role);
      return true;
    },
  };
}

export type SharedNote = {
  id: string;
  text: string;
  peerId: string;
  createdAt: number;
};
export function useSharedNotes(room: YRoom | null, key = "notes") {
  useSharedVersion(room, key, "array");
  const list = room?.doc.getArray<SharedNote>(key);
  const notes =
    list
      ?.toArray()
      .filter(
        (note) => note && note.id && note.text && note.text.length <= 500,
      ) ?? [];
  return {
    notes,
    add: (text: string, id = `${room?.peerId ?? "local"}-${Date.now()}`) => {
      const clean = text.trim();
      if (
        !room ||
        !list ||
        !clean ||
        clean.length > 500 ||
        notes.some((note) => note.id === id)
      )
        return false;
      list.push([
        { id, text: clean, peerId: room.peerId, createdAt: Date.now() },
      ]);
      return true;
    },
    remove: (id: string) => {
      if (!list) return false;
      const index = notes.findIndex(
        (note) => note.id === id && note.peerId === room?.peerId,
      );
      if (index < 0) return false;
      list.delete(index, 1);
      return true;
    },
  };
}

export type SharedRound = { number: number; startedAt: number | null };
export function useSharedRound(room: YRoom | null, key = "round") {
  useSharedVersion(room, key, "map");
  const map = room?.doc.getMap<number>(key);
  const number = map?.get("number") ?? 0;
  const startedAt = map?.get("startedAt") ?? null;
  return {
    round: { number, startedAt } as SharedRound,
    next: () => {
      if (!map) return false;
      map.set("number", Math.max(0, Math.floor(number)) + 1);
      map.set("startedAt", Date.now());
      return true;
    },
    reset: () => {
      if (!map) return false;
      map.set("number", 0);
      map.delete("startedAt");
      return true;
    },
  };
}

export type SharedReaction = {
  emoji: string;
  peerIds: string[];
  count: number;
};
export function useSharedReactions(room: YRoom | null, key = "reactions") {
  useSharedVersion(room, key, "map");
  const map = room?.doc.getMap<string[]>(key);
  const reactions = [...(map?.entries() ?? [])].flatMap(([emoji, peerIds]) =>
    Array.isArray(peerIds) && emoji.length <= 16
      ? [
          {
            emoji,
            peerIds: [...new Set(peerIds)].sort(),
            count: new Set(peerIds).size,
          },
        ]
      : [],
  );
  return {
    reactions,
    toggle: (emoji: string) => {
      if (!room || !map || !emoji.trim() || emoji.length > 16) return false;
      const peers = new Set(map.get(emoji) ?? []);
      if (peers.has(room.peerId)) peers.delete(room.peerId);
      else peers.add(room.peerId);
      map.set(emoji, [...peers]);
      return true;
    },
  };
}
