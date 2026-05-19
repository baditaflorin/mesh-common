import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Buffer writes when isolated, replay when reconnected. Designed for apps that
 * survive flaky transit / school wifi: the user keeps typing, you keep queuing,
 * and once `online` flips back to true the queue drains through your `flush`.
 *
 * Persistence is opt-in (localStorage by default). Each enqueued item carries
 * an idempotency key — if the network was up but your peer didn't receive
 * the ack (CRDT replicated, ack lost), replay is a no-op as long as your
 * `flush` is idempotent.
 *
 *   const queue = useOfflineQueue<MsgDraft>({
 *     online,
 *     flush: async (item) => sendToRoom(item),
 *     storageKey: "mesh-foo:queue",
 *   });
 *
 *   onSend(() => queue.enqueue({ id: makeId(), body }));
 *   queue.size  // "waiting to send (3)"
 *   queue.pending  // array view, e.g. to render
 *
 * Honest framing: this is at-least-once delivery, not exactly-once. Make `flush`
 * idempotent. The id is the natural caller-controlled idempotency key.
 */

export type QueueItem<T> = {
  /** Caller-controlled idempotency key. Used to dedupe + report progress. */
  id: string;
  payload: T;
  /** Local timestamp when enqueued (for stale-drop policies). */
  enqueuedAt: number;
  /** How many delivery attempts have been made. */
  attempts: number;
};

export type OfflineQueueOptions<T> = {
  /** Live online signal — when this flips true we drain. */
  online: boolean;
  /** Idempotent delivery. Throw / reject to retry later. */
  flush: (item: QueueItem<T>) => Promise<void>;
  /** localStorage key. Pass null to disable persistence. Default `mesh-offline-queue`. */
  storageKey?: string | null;
  /** ms between drain attempts when items are still queued. Default 1_000. */
  retryMs?: number;
  /** Drop items older than this. Default Infinity (never). */
  maxAgeMs?: number;
  /** Cap on queue length. Drops oldest beyond this. Default 200. */
  maxItems?: number;
};

export type OfflineQueueApi<T> = {
  size: number;
  pending: ReadonlyArray<QueueItem<T>>;
  enqueue: (item: { id: string; payload: T }) => void;
  /** Remove an item by id (caller did an out-of-band success). */
  ack: (id: string) => void;
  /** Drop everything. */
  clear: () => void;
};

function loadFromStorage<T>(key: string | null | undefined): QueueItem<T>[] {
  if (!key || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is QueueItem<T> =>
        it && typeof it === "object" && typeof it.id === "string" && typeof it.enqueuedAt === "number",
    );
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string | null | undefined, items: QueueItem<T>[]): void {
  if (!key || typeof localStorage === "undefined") return;
  try {
    if (items.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* quota errors are non-fatal — the queue stays in memory */
  }
}

export function useOfflineQueue<T>(opts: OfflineQueueOptions<T>): OfflineQueueApi<T> {
  const {
    online,
    flush,
    storageKey = "mesh-offline-queue",
    retryMs = 1_000,
    maxAgeMs = Infinity,
    maxItems = 200,
  } = opts;

  const [items, setItems] = useState<QueueItem<T>[]>(() => loadFromStorage<T>(storageKey));
  const itemsRef = useRef(items);
  const inFlight = useRef<Set<string>>(new Set());
  const draining = useRef(false);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const commit = useCallback(
    (next: QueueItem<T>[]) => {
      const trimmed = next.length > maxItems ? next.slice(next.length - maxItems) : next;
      itemsRef.current = trimmed;
      setItems(trimmed);
      saveToStorage(storageKey, trimmed);
    },
    [storageKey, maxItems],
  );

  const enqueue = useCallback(
    (item: { id: string; payload: T }) => {
      const existing = itemsRef.current;
      // Idempotency: drop dup ids.
      if (existing.some((i) => i.id === item.id)) return;
      const next: QueueItem<T>[] = [
        ...existing,
        { id: item.id, payload: item.payload, enqueuedAt: Date.now(), attempts: 0 },
      ];
      commit(next);
    },
    [commit],
  );

  const ack = useCallback(
    (id: string) => {
      commit(itemsRef.current.filter((i) => i.id !== id));
    },
    [commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  // Drain loop
  useEffect(() => {
    if (!online) return;
    if (itemsRef.current.length === 0) return;

    let cancelled = false;
    let retryHandle: ReturnType<typeof setTimeout> | null = null;

    const drain = async () => {
      if (cancelled || draining.current) return;
      draining.current = true;
      try {
        while (!cancelled && itemsRef.current.length > 0) {
          // Drop too-old items first.
          if (Number.isFinite(maxAgeMs)) {
            const cutoff = Date.now() - maxAgeMs;
            const fresh = itemsRef.current.filter((i) => i.enqueuedAt >= cutoff);
            if (fresh.length !== itemsRef.current.length) commit(fresh);
            if (fresh.length === 0) break;
          }
          const head = itemsRef.current[0]!;
          if (inFlight.current.has(head.id)) break;
          inFlight.current.add(head.id);
          try {
            await flushRef.current({ ...head, attempts: head.attempts + 1 });
            inFlight.current.delete(head.id);
            commit(itemsRef.current.filter((i) => i.id !== head.id));
          } catch {
            inFlight.current.delete(head.id);
            commit(
              itemsRef.current.map((i) =>
                i.id === head.id ? { ...i, attempts: i.attempts + 1 } : i,
              ),
            );
            // Back off and retry.
            await new Promise<void>((resolve) => {
              retryHandle = setTimeout(resolve, retryMs);
            });
          }
        }
      } finally {
        draining.current = false;
      }
    };

    void drain();
    return () => {
      cancelled = true;
      if (retryHandle) clearTimeout(retryHandle);
    };
  }, [online, items.length, commit, retryMs, maxAgeMs]);

  return { size: items.length, pending: items, enqueue, ack, clear };
}
