import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

/** A bounded, plain-text chat message with its sending peer and timestamp. */
export type SharedMessage = {
  id: string;
  body: string;
  authorId: string;
  sentAt: number;
};

const MAX_MESSAGES = 500;
const MAX_ID_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1_000;

function isIdentifier(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function isMessage(value: unknown): value is SharedMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as SharedMessage;
  return (
    isIdentifier(message.id) &&
    isIdentifier(message.authorId) &&
    typeof message.body === "string" &&
    message.body.trim().length > 0 &&
    message.body.length <= MAX_MESSAGE_LENGTH &&
    Number.isFinite(message.sentAt)
  );
}

/**
 * An append-only room message stream backed by a Y.Array.
 *
 * `send` accepts plain text only, attributes it to the local peer, and
 * rejects duplicate ids and room histories over 500 entries. Reads discard
 * malformed remote values and provide a deterministic chronological order.
 */
export function useSharedMessages(room: YRoom | null, key = "messages") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const list = room.doc.getArray<SharedMessage>(key);
    const update = () => rerender((version) => version + 1);
    list.observe(update);
    return () => list.unobserve(update);
  }, [room, key]);

  const list = room?.doc.getArray<SharedMessage>(key);
  const messages = (list?.toArray() ?? [])
    .filter(isMessage)
    .slice(-MAX_MESSAGES)
    .sort((a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id));

  return {
    messages,
    mine: messages.filter((message) => message.authorId === room?.peerId),
    send: (body: string, id = `${room?.peerId ?? "local"}-${Date.now()}`) => {
      const clean = typeof body === "string" ? body.trim() : "";
      if (
        !room ||
        !list ||
        !isIdentifier(id) ||
        !clean ||
        clean.length > MAX_MESSAGE_LENGTH ||
        list.length >= MAX_MESSAGES ||
        list.toArray().some((entry) => entry?.id === id)
      ) {
        return false;
      }
      list.push([
        { id, body: clean, authorId: room.peerId, sentAt: Date.now() },
      ]);
      return true;
    },
    remove: (id: string) => {
      if (!list || !isIdentifier(id)) return false;
      const index = list.toArray().findIndex((entry) => entry?.id === id);
      if (index < 0) return false;
      list.delete(index, 1);
      return true;
    },
    clear: () => {
      if (!list || list.length === 0) return false;
      list.delete(0, list.length);
      return true;
    },
  };
}
