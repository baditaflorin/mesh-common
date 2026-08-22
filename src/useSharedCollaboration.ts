import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

function useVersion(room: YRoom | null, key: string, type: "map" | "array") {
  const [, bump] = useState(0);

  useEffect(() => {
    if (!room) return;
    const value =
      type === "map" ? room.doc.getMap(key) : room.doc.getArray(key);
    const update = () => bump((version) => version + 1);
    value.observe(update);
    return () => value.unobserve(update);
  }, [room, key, type]);
}

export type RsvpStatus = "yes" | "maybe" | "no";
export type SharedRsvpEntry = {
  peerId: string;
  status: RsvpStatus;
  updatedAt: number;
};

/** A peer-attributed RSVP map for a single event or open-house room. */
export function useSharedRsvp(room: YRoom | null, key = "rsvp") {
  useVersion(room, key, "map");
  const map = room?.doc.getMap<SharedRsvpEntry>(key);
  const entries = [...(map?.entries() ?? [])]
    .flatMap(([peerId, entry]) =>
      entry ? [entry.peerId === peerId ? entry : { ...entry, peerId }] : [],
    )
    .filter((entry): entry is SharedRsvpEntry =>
      ["yes", "maybe", "no"].includes(entry.status),
    )
    .sort((a, b) => a.peerId.localeCompare(b.peerId));
  const counts = Object.fromEntries(
    (["yes", "maybe", "no"] as RsvpStatus[]).map((status) => [
      status,
      entries.filter((entry) => entry.status === status).length,
    ]),
  ) as Record<RsvpStatus, number>;

  return {
    entries,
    mine: entries.find((entry) => entry.peerId === room?.peerId) ?? null,
    counts,
    set: (status: RsvpStatus) => {
      if (!room || !map) return false;
      map.set(room.peerId, {
        peerId: room.peerId,
        status,
        updatedAt: Date.now(),
      });
      return true;
    },
    clear: () => {
      if (!room || !map) return false;
      map.delete(room.peerId);
      return true;
    },
  };
}

export type SharedAgendaItem = {
  id: string;
  title: string;
  durationMinutes: number;
};

/** An ordered agenda plus a separately replicated current-item marker. */
export function useSharedAgenda(room: YRoom | null, key = "agenda") {
  useVersion(room, key, "array");
  useVersion(room, `${key}:current`, "map");
  const list = room?.doc.getArray<SharedAgendaItem>(key);
  const items =
    list
      ?.toArray()
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          Number.isFinite(item.durationMinutes),
      ) ?? [];
  const currentMap = room?.doc.getMap<string>(`${key}:current`);
  const currentId = currentMap?.get("id") ?? null;

  return {
    items,
    currentId,
    add: (item: SharedAgendaItem) => {
      if (
        !list ||
        !item.id ||
        !item.title.trim() ||
        item.title.length > 120 ||
        !Number.isFinite(item.durationMinutes) ||
        items.some((entry) => entry.id === item.id)
      ) {
        return false;
      }
      list.push([
        {
          ...item,
          title: item.title.trim(),
          durationMinutes: Math.max(
            1,
            Math.min(480, Math.round(item.durationMinutes)),
          ),
        },
      ]);
      return true;
    },
    setCurrent: (id: string | null) => {
      if (!currentMap) return false;
      if (id === null) currentMap.delete("id");
      else if (items.some((item) => item.id === id)) currentMap.set("id", id);
      else return false;
      return true;
    },
    remove: (id: string) => {
      if (!list) return false;
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return false;
      list.delete(index, 1);
      if (currentId === id) currentMap?.delete("id");
      return true;
    },
  };
}

/** A peer-attributed bounded score map for lightweight games and challenges. */
export function useSharedScoreboard(room: YRoom | null, key = "scoreboard") {
  useVersion(room, key, "map");
  const map = room?.doc.getMap<number>(key);
  const scores = [...(map?.entries() ?? [])]
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    )
    .map(([peerId, score]) => ({ peerId, score }))
    .sort((a, b) => b.score - a.score || a.peerId.localeCompare(b.peerId));

  return {
    scores,
    add: (delta: number, peerId = room?.peerId ?? "") => {
      if (!map || !peerId || !Number.isFinite(delta)) return false;
      map.set(
        peerId,
        Math.max(
          -9999,
          Math.min(9999, (map.get(peerId) ?? 0) + Math.trunc(delta)),
        ),
      );
      return true;
    },
    reset: () => {
      if (!map) return false;
      map.clear();
      return true;
    },
  };
}

export type SharedPrompt = { id: string; text: string };

/** An ordered prompt deck with a shared selected-card marker. */
export function useSharedPromptDeck(room: YRoom | null, key = "prompt-deck") {
  useVersion(room, key, "array");
  useVersion(room, `${key}:selected`, "map");
  const list = room?.doc.getArray<SharedPrompt>(key);
  const prompts =
    list
      ?.toArray()
      .filter(
        (prompt) =>
          prompt &&
          typeof prompt.id === "string" &&
          typeof prompt.text === "string",
      ) ?? [];
  const selected = room?.doc.getMap<string>(`${key}:selected`);
  const currentId = selected?.get("id") ?? null;

  return {
    prompts,
    current: prompts.find((prompt) => prompt.id === currentId) ?? null,
    add: (prompt: SharedPrompt) => {
      if (
        !list ||
        !prompt.id ||
        !prompt.text.trim() ||
        prompt.text.length > 280 ||
        prompts.some((entry) => entry.id === prompt.id)
      ) {
        return false;
      }
      list.push([{ ...prompt, text: prompt.text.trim() }]);
      return true;
    },
    select: (id: string | null) => {
      if (!selected) return false;
      if (id === null) selected.delete("id");
      else if (prompts.some((prompt) => prompt.id === id))
        selected.set("id", id);
      else return false;
      return true;
    },
    remove: (id: string) => {
      if (!list) return false;
      const index = prompts.findIndex((prompt) => prompt.id === id);
      if (index < 0) return false;
      list.delete(index, 1);
      if (currentId === id) selected?.delete("id");
      return true;
    },
  };
}

export type SharedResponse = {
  peerId: string;
  text: string;
  updatedAt: number;
};

/** One bounded plain-text response per peer, suitable for walls and check-ins. */
export function useSharedResponses(room: YRoom | null, key = "responses") {
  useVersion(room, key, "map");
  const map = room?.doc.getMap<SharedResponse>(key);
  const responses = [...(map?.entries() ?? [])]
    .flatMap(([peerId, value]) =>
      value && typeof value.text === "string" && value.text.length <= 280
        ? [{ ...value, peerId }]
        : [],
    )
    .sort(
      (a, b) => a.updatedAt - b.updatedAt || a.peerId.localeCompare(b.peerId),
    );

  return {
    responses,
    mine:
      responses.find((response) => response.peerId === room?.peerId) ?? null,
    submit: (text: string) => {
      const clean = text.trim();
      if (!room || !map || !clean || clean.length > 280) return false;
      map.set(room.peerId, {
        peerId: room.peerId,
        text: clean,
        updatedAt: Date.now(),
      });
      return true;
    },
    clear: () => {
      if (!room || !map) return false;
      map.delete(room.peerId);
      return true;
    },
  };
}
