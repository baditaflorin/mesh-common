import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

function useFacilitationVersion(
  room: YRoom | null,
  key: string,
  array = false,
) {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!room) return;
    const type = array ? room.doc.getArray(key) : room.doc.getMap(key);
    const update = () => redraw((n) => n + 1);
    type.observe(update);
    return () => type.unobserve(update);
  }, [room, key, array]);
}

export function useSharedRatings(room: YRoom | null, key = "ratings") {
  useFacilitationVersion(room, key);
  const map = room?.doc.getMap<number>(key);
  const ratings = [...(map?.entries() ?? [])].flatMap(([peerId, value]) =>
    typeof value === "number" && value >= 1 && value <= 5
      ? [{ peerId, value }]
      : [],
  );
  const average = ratings.length
    ? ratings.reduce((sum, entry) => sum + entry.value, 0) / ratings.length
    : null;
  return {
    ratings,
    average,
    setMine: (value: number) => {
      if (!room || !map || !Number.isInteger(value) || value < 1 || value > 5)
        return false;
      map.set(room.peerId, value);
      return true;
    },
  };
}
export function useSharedWordCloud(room: YRoom | null, key = "words") {
  useFacilitationVersion(room, key);
  const map = room?.doc.getMap<string>(key);
  const entries = [...(map?.entries() ?? [])].flatMap(([peerId, word]) =>
    typeof word === "string" && word.length <= 40 ? [{ peerId, word }] : [],
  );
  const words = [...new Set(entries.map((entry) => entry.word))]
    .map((word) => ({
      word,
      count: entries.filter((entry) => entry.word === word).length,
    }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return {
    entries,
    words,
    submit: (word: string) => {
      const clean = word.trim().toLocaleLowerCase();
      if (!room || !map || !clean || clean.length > 40) return false;
      map.set(room.peerId, clean);
      return true;
    },
  };
}
export type LotteryEntry = { peerId: string; label: string };
export function useSharedLottery(room: YRoom | null, key = "lottery") {
  useFacilitationVersion(room, key);
  const map = room?.doc.getMap<LotteryEntry | string>(key);
  const entries = [...(map?.entries() ?? [])]
    .flatMap(([peerId, entry]) =>
      typeof entry === "string"
        ? []
        : entry?.peerId === peerId && entry.label
          ? [entry]
          : [],
    )
    .sort((a, b) => a.peerId.localeCompare(b.peerId));
  const winner =
    typeof map?.get("winner") === "string"
      ? (map.get("winner") as string)
      : null;
  return {
    entries,
    winner,
    enter: (label: string) => {
      const clean = label.trim();
      if (!room || !map || !clean || clean.length > 80) return false;
      map.set(room.peerId, { peerId: room.peerId, label: clean });
      return true;
    },
    draw: () => {
      if (!map || !entries.length) return false;
      const selected = entries[Math.floor(Math.random() * entries.length)];
      if (!selected) return false;
      map.set("winner", selected.peerId);
      return true;
    },
  };
}
export type SharedMilestone = { id: string; label: string; complete: boolean };
export function useSharedMilestones(room: YRoom | null, key = "milestones") {
  useFacilitationVersion(room, key, true);
  const list = room?.doc.getArray<SharedMilestone>(key);
  const milestones =
    list?.toArray().filter((item) => item?.id && item.label) ?? [];
  return {
    milestones,
    add: (label: string, id = `${room?.peerId ?? "local"}-${Date.now()}`) => {
      const clean = label.trim();
      if (
        !list ||
        !clean ||
        clean.length > 120 ||
        milestones.some((item) => item.id === id)
      )
        return false;
      list.push([{ id, label: clean, complete: false }]);
      return true;
    },
    toggle: (id: string) => {
      if (!list) return false;
      const index = milestones.findIndex((item) => item.id === id);
      const item = milestones[index];
      if (index < 0 || !item) return false;
      list.delete(index, 1);
      list.insert(index, [{ ...item, complete: !item.complete }]);
      return true;
    },
  };
}
export type PlaylistEntry = { id: string; title: string; addedBy: string };
export function useSharedPlaylist(room: YRoom | null, key = "playlist") {
  useFacilitationVersion(room, key, true);
  const list = room?.doc.getArray<PlaylistEntry>(key);
  const entries =
    list?.toArray().filter((item) => item?.id && item.title) ?? [];
  return {
    entries,
    add: (title: string, id = `${room?.peerId ?? "local"}-${Date.now()}`) => {
      const clean = title.trim();
      if (
        !room ||
        !list ||
        !clean ||
        clean.length > 160 ||
        entries.some((item) => item.id === id)
      )
        return false;
      list.push([{ id, title: clean, addedBy: room.peerId }]);
      return true;
    },
    removeMine: (id: string) => {
      if (!room || !list) return false;
      const index = entries.findIndex(
        (item) => item.id === id && item.addedBy === room.peerId,
      );
      if (index < 0) return false;
      list.delete(index, 1);
      return true;
    },
  };
}
