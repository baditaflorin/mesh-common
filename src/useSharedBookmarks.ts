import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

/** A bounded, peer-attributed HTTP(S) bookmark that is safe to render as plain data. */
export type SharedBookmark = {
  id: string;
  url: string;
  title: string;
  addedBy: string;
  addedAt: number;
};

const MAX_BOOKMARKS = 200;
const MAX_ID_LENGTH = 120;
const MAX_TITLE_LENGTH = 160;
const MAX_URL_LENGTH = 2_048;

function isIdentifier(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function normalizedHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function isBookmark(value: unknown): value is SharedBookmark {
  if (!value || typeof value !== "object") return false;
  const bookmark = value as SharedBookmark;
  return (
    isIdentifier(bookmark.id) &&
    isIdentifier(bookmark.addedBy) &&
    typeof bookmark.title === "string" &&
    bookmark.title.trim().length > 0 &&
    bookmark.title.length <= MAX_TITLE_LENGTH &&
    normalizedHttpUrl(bookmark.url) !== null &&
    Number.isFinite(bookmark.addedAt)
  );
}

/**
 * A shared, ordered bookmark list backed by a Y.Array.
 *
 * Values are constrained to small HTTP(S) URLs and plain text titles. The
 * hook keeps at most 200 local entries visible and rejects writes beyond that
 * limit, so a room cannot grow indefinitely through this primitive alone.
 */
export function useSharedBookmarks(room: YRoom | null, key = "bookmarks") {
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const list = room.doc.getArray<SharedBookmark>(key);
    const update = () => rerender((version) => version + 1);
    list.observe(update);
    return () => list.unobserve(update);
  }, [room, key]);

  const list = room?.doc.getArray<SharedBookmark>(key);
  const bookmarks = (list?.toArray() ?? [])
    .filter(isBookmark)
    .slice(-MAX_BOOKMARKS)
    .map((bookmark) => ({
      ...bookmark,
      url: normalizedHttpUrl(bookmark.url)!,
    }));

  return {
    bookmarks,
    add: (bookmark: Omit<SharedBookmark, "addedBy" | "addedAt">) => {
      const url = normalizedHttpUrl(bookmark?.url);
      const title =
        typeof bookmark?.title === "string" ? bookmark.title.trim() : "";
      if (
        !room ||
        !list ||
        !isIdentifier(bookmark?.id) ||
        !url ||
        !title ||
        title.length > MAX_TITLE_LENGTH ||
        list.length >= MAX_BOOKMARKS ||
        list.toArray().some((entry) => entry?.id === bookmark.id)
      ) {
        return false;
      }
      list.push([
        {
          id: bookmark.id,
          url,
          title,
          addedBy: room.peerId,
          addedAt: Date.now(),
        },
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
