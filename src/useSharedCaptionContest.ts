import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

const MAX_PROMPT_LENGTH = 280;
const MAX_CAPTION_LENGTH = 280;
const MAX_CAPTIONS = 250;
const MAX_VOTERS_PER_CAPTION = 250;

export type SharedCaption = {
  peerId: string;
  text: string;
  submittedAt: number;
  voterIds: string[];
  votes: number;
};

type StoredCaption = Omit<SharedCaption, "votes">;

function isPeerId(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 120
  );
}

function isText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isStoredCaption(value: unknown): value is StoredCaption {
  if (!value || typeof value !== "object") return false;
  const caption = value as Partial<StoredCaption>;
  return (
    isPeerId(caption.peerId) &&
    isText(caption.text, MAX_CAPTION_LENGTH) &&
    typeof caption.submittedAt === "number" &&
    Number.isFinite(caption.submittedAt) &&
    Array.isArray(caption.voterIds) &&
    caption.voterIds.length <= MAX_VOTERS_PER_CAPTION &&
    caption.voterIds.every(isPeerId)
  );
}

/**
 * A one-caption-per-peer contest with a shared plain-text prompt and
 * independent upvotes. Captions are stored by author id, preventing one peer
 * from flooding a room while still allowing everyone to revise their entry.
 */
export function useSharedCaptionContest(
  room: YRoom | null,
  key = "caption-contest",
) {
  const [, rerender] = useState(0);
  const promptKey = `${key}:prompt`;
  const captionsKey = `${key}:captions`;

  useEffect(() => {
    if (!room) return;
    const prompt = room.doc.getMap<string>(promptKey);
    const captions = room.doc.getMap<StoredCaption>(captionsKey);
    const update = () => rerender((version) => version + 1);
    prompt.observe(update);
    captions.observe(update);
    return () => {
      prompt.unobserve(update);
      captions.unobserve(update);
    };
  }, [room, promptKey, captionsKey]);

  const promptMap = room?.doc.getMap<string>(promptKey) ?? null;
  const captionsMap = room?.doc.getMap<StoredCaption>(captionsKey) ?? null;
  const rawPrompt = promptMap?.get("text") ?? "";
  const prompt = isText(rawPrompt, MAX_PROMPT_LENGTH) ? rawPrompt : null;
  const captions = [...(captionsMap?.values() ?? [])]
    .filter(isStoredCaption)
    .map((caption) => {
      const voterIds = [...new Set(caption.voterIds)].sort();
      return { ...caption, voterIds, votes: voterIds.length };
    })
    .sort(
      (a, b) =>
        b.votes - a.votes ||
        a.submittedAt - b.submittedAt ||
        a.peerId.localeCompare(b.peerId),
    );

  return {
    prompt,
    captions,
    mine: captions.find((caption) => caption.peerId === room?.peerId) ?? null,
    setPrompt: (text: string) => {
      const clean = typeof text === "string" ? text.trim() : "";
      if (!promptMap || !clean || clean.length > MAX_PROMPT_LENGTH)
        return false;
      promptMap.set("text", clean);
      return true;
    },
    submit: (text: string) => {
      const clean = typeof text === "string" ? text.trim() : "";
      if (
        !room ||
        !captionsMap ||
        !clean ||
        clean.length > MAX_CAPTION_LENGTH ||
        (!captionsMap.has(room.peerId) && captionsMap.size >= MAX_CAPTIONS)
      ) {
        return false;
      }
      const existing = captionsMap.get(room.peerId);
      captionsMap.set(room.peerId, {
        peerId: room.peerId,
        text: clean,
        submittedAt:
          existing && isStoredCaption(existing)
            ? existing.submittedAt
            : Date.now(),
        voterIds:
          existing && isStoredCaption(existing) ? existing.voterIds : [],
      });
      return true;
    },
    /** Toggle the local peer's vote; authors cannot vote for themselves. */
    toggleVote: (peerId: string) => {
      const caption = captionsMap?.get(peerId);
      if (
        !room ||
        !captionsMap ||
        !isStoredCaption(caption) ||
        peerId === room.peerId
      ) {
        return false;
      }
      const voters = new Set(caption.voterIds);
      if (voters.has(room.peerId)) voters.delete(room.peerId);
      else if (voters.size >= MAX_VOTERS_PER_CAPTION) return false;
      else voters.add(room.peerId);
      captionsMap.set(peerId, { ...caption, voterIds: [...voters].sort() });
      return true;
    },
    clearMine: () => {
      if (!room || !captionsMap || !captionsMap.has(room.peerId)) return false;
      captionsMap.delete(room.peerId);
      return true;
    },
    reset: () => {
      if (!promptMap || !captionsMap) return false;
      const changed = promptMap.size > 0 || captionsMap.size > 0;
      if (!changed) return false;
      room?.doc.transact(() => {
        promptMap.clear();
        captionsMap.clear();
      });
      return true;
    },
  };
}
