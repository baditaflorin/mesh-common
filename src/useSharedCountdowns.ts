import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_COUNTDOWNS = 50;
const MAX_LABEL_LENGTH = 120;
const MAX_DURATION_MS = 86_400_000;

type StoredCountdown = {
  id: string;
  label: string;
  durationMs: number;
  remainingMs: number;
  running: boolean;
  startedAt: number | null;
  createdBy: string;
};

export type SharedCountdownState = "idle" | "running" | "paused" | "finished";

/** A display-ready, drift-free view of one replicated countdown. */
export type SharedCountdown = {
  id: string;
  label: string;
  durationMs: number;
  remainingMs: number;
  state: SharedCountdownState;
  startedAt: number | null;
  createdBy: string;
};

function isIdentifier(value: unknown) {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 120
  );
}

function isDuration(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_DURATION_MS
  );
}

function isStoredCountdown(value: unknown): value is StoredCountdown {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoredCountdown>;
  return (
    isIdentifier(item.id) &&
    typeof item.label === "string" &&
    item.label.trim().length > 0 &&
    item.label.length <= MAX_LABEL_LENGTH &&
    isDuration(item.durationMs) &&
    typeof item.remainingMs === "number" &&
    Number.isFinite(item.remainingMs) &&
    item.remainingMs >= 0 &&
    item.durationMs !== undefined &&
    item.remainingMs <= item.durationMs &&
    typeof item.running === "boolean" &&
    (item.startedAt === null ||
      (typeof item.startedAt === "number" &&
        Number.isFinite(item.startedAt))) &&
    isIdentifier(item.createdBy)
  );
}

function remainingAt(item: StoredCountdown, now: number) {
  if (!item.running || item.startedAt === null) return item.remainingMs;
  return Math.max(0, item.remainingMs - Math.max(0, now - item.startedAt));
}

function viewOf(item: StoredCountdown, now: number): SharedCountdown {
  const remainingMs = remainingAt(item, now);
  const state: SharedCountdownState =
    remainingMs === 0
      ? "finished"
      : item.running
        ? "running"
        : item.remainingMs === item.durationMs
          ? "idle"
          : "paused";
  return {
    id: item.id,
    label: item.label,
    durationMs: item.durationMs,
    remainingMs,
    state,
    startedAt: item.startedAt,
    createdBy: item.createdBy,
  };
}

/**
 * Replicated countdowns that store only lifecycle timestamps. Every peer
 * derives the ticking display locally, avoiding a CRDT write for every tick.
 */
export function useSharedCountdowns(room: YRoom | null, key = "countdowns") {
  const [, rerender] = useState(0);
  const list = room?.doc.getArray<StoredCountdown>(key) ?? null;
  const stored = list?.toArray().filter(isStoredCountdown) ?? [];
  const hasRunningCountdown = stored.some(
    (item) => item.running && item.startedAt !== null && item.remainingMs > 0,
  );

  useEffect(() => {
    if (!room) return;
    const array = room.doc.getArray<StoredCountdown>(key);
    const update = () => rerender((version) => version + 1);
    array.observe(update);
    return () => array.unobserve(update);
  }, [room, key]);

  useEffect(() => {
    if (!hasRunningCountdown) return;
    const timer = setInterval(() => rerender((version) => version + 1), 250);
    return () => clearInterval(timer);
  }, [hasRunningCountdown]);

  const now = Date.now();
  const countdowns = stored
    .map((item) => viewOf(item, now))
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const findCurrent = (id: string) => {
    const values = list?.toArray() ?? [];
    const index = values.findIndex(
      (item) => isStoredCountdown(item) && item.id === id,
    );
    const item = index < 0 ? null : values[index];
    return item && isStoredCountdown(item) ? { index, item } : null;
  };
  const replace = (id: string, next: StoredCountdown) => {
    const current = findCurrent(id);
    if (!list || !room || !current) return false;
    room.doc.transact(() => {
      list.delete(current.index, 1);
      list.insert(current.index, [next]);
    });
    return true;
  };

  return {
    countdowns,
    /** Add a named countdown. Optional ids make app-level deep links stable. */
    add: (
      label: string,
      durationMs: number,
      id = `${room?.peerId ?? "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ) => {
      const clean = label.trim();
      if (
        !room ||
        !list ||
        !isIdentifier(id) ||
        !clean ||
        clean.length > MAX_LABEL_LENGTH ||
        !isDuration(durationMs) ||
        list.length >= MAX_COUNTDOWNS ||
        findCurrent(id)
      ) {
        return false;
      }
      list.push([
        {
          id,
          label: clean,
          durationMs,
          remainingMs: durationMs,
          running: false,
          startedAt: null,
          createdBy: room.peerId,
        },
      ]);
      return true;
    },
    /** Start or resume a countdown. Finished countdowns start over. */
    start: (id: string) => {
      const current = findCurrent(id);
      if (!current || current.item.running) return false;
      const remainingMs = remainingAt(current.item, Date.now());
      return replace(id, {
        ...current.item,
        remainingMs: remainingMs || current.item.durationMs,
        running: true,
        startedAt: Date.now(),
      });
    },
    /** Freeze a running countdown at its derived remaining time. */
    pause: (id: string) => {
      const current = findCurrent(id);
      if (!current || !current.item.running) return false;
      const remainingMs = remainingAt(current.item, Date.now());
      if (remainingMs === 0) return false;
      return replace(id, {
        ...current.item,
        remainingMs,
        running: false,
        startedAt: null,
      });
    },
    /** Return a countdown to its configured duration. */
    reset: (id: string) => {
      const current = findCurrent(id);
      if (!current) return false;
      return replace(id, {
        ...current.item,
        remainingMs: current.item.durationMs,
        running: false,
        startedAt: null,
      });
    },
    remove: (id: string) => {
      const current = findCurrent(id);
      if (!list || !current) return false;
      list.delete(current.index, 1);
      return true;
    },
  };
}
