import { useCallback, useEffect, useState } from "react";
import type { YRoom } from "../useYRoom";

export type DM<T> = {
  id: string;
  from: string;
  to: string;
  ts: number;
  /** True iff this DM was marked-read by the recipient. */
  read: boolean;
  payload: T;
};

export type DirectMessageState<T> = {
  /** All DMs addressed to this peer (oldest first). */
  inbox: DM<T>[];
  /** Unread DMs from `peerId` (or all unread when omitted). */
  unread: (peerId?: string) => DM<T>[];
  /** Send a DM. Returns the message id. */
  send: (toPeerId: string, payload: T) => string;
  /** Mark one DM as read. */
  markRead: (id: string) => void;
  /** Mark all DMs from `peerId` as read (or all when omitted). */
  markAllRead: (peerId?: string) => void;
  /** Total DM count addressed to this peer. */
  size: number;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Targeted peer-to-peer messages over a `Y.Array<DM<T>>`. Senders append;
 * recipients filter by `to === room.peerId`. Read state is per-recipient in
 * a separate `Y.Map<id, true>` so recipients can mark-read without rewriting
 * the message log.
 *
 *   const dm = useDirectMessage<{ text: string }>(room, "whispers");
 *   dm.send(targetPeer, { text: "psst" });
 *   dm.inbox.map(m => <div>{m.payload.text}</div>);
 *
 * For encryption, layer with `useEphemeralKey`:
 *   dm.send(target, { text: ek.seal(theirPubkey, "secret") });
 */
export function useDirectMessage<T>(
  room: YRoom | null,
  key: string,
): DirectMessageState<T> {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<DM<T>>(key);
    const reads = room.doc.getMap<boolean>(`${key}_reads`);
    const cb = () => rerender((n) => n + 1);
    arr.observe(cb);
    reads.observe(cb);
    return () => {
      arr.unobserve(cb);
      reads.unobserve(cb);
    };
  }, [room, key]);

  const arr = room ? room.doc.getArray<DM<T>>(key) : null;
  const reads = room ? room.doc.getMap<boolean>(`${key}_reads`) : null;

  const all = arr ? arr.toArray() : [];
  const myPeer = room?.peerId ?? "";
  const inbox = all
    .filter((m) => m.to === myPeer)
    .map((m) => ({ ...m, read: reads?.get(m.id) ?? false }));

  const send = useCallback(
    (toPeerId: string, payload: T) => {
      if (!room || !arr) return "";
      const dm: DM<T> = {
        id: newId(),
        from: room.peerId,
        to: toPeerId,
        ts: Date.now(),
        read: false,
        payload,
      };
      arr.push([dm]);
      return dm.id;
    },
    [room, arr],
  );

  const markRead = useCallback(
    (id: string) => {
      if (!reads) return;
      reads.set(id, true);
    },
    [reads],
  );

  const markAllRead = useCallback(
    (peerId?: string) => {
      if (!reads) return;
      room?.doc.transact(() => {
        for (const m of inbox) {
          if (peerId && m.from !== peerId) continue;
          if (!m.read) reads.set(m.id, true);
        }
      });
    },
    [reads, room, inbox],
  );

  return {
    inbox,
    unread: (peerId) =>
      inbox.filter((m) => !m.read && (!peerId || m.from === peerId)),
    send,
    markRead,
    markAllRead,
    size: inbox.length,
  };
}
