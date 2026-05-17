import { useEffect, useState } from "react";
import type { YRoom } from "./useYRoom";

export type Toast = {
  id: string;
  peerId: string;
  msg: string;
  ts: number;
  /** Time-to-live in ms from `ts`. Defaults to 4000. */
  ttl: number;
  /** Optional CSS modifier class (e.g. "is-warning"). */
  kind?: string;
};

const TOAST_KEY = "__mesh_toasts";

function newId() {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Append a transient toast that every peer will render. The Y.Array entry is
 * intentionally never cleaned up by the publisher — receivers self-prune
 * based on `ts + ttl`. Late joiners see no backlog because filtering happens
 * at render time.
 *
 * Pass the publishing `peerId` if you want the receiver to be able to render
 * "alice: …" — otherwise just send the message.
 */
export function pushToast(
  room: YRoom | null,
  msg: string,
  opts?: { ttl?: number; kind?: string; peerId?: string },
): void {
  if (!room) return;
  const peerId = opts?.peerId ?? room.peerId;
  const ttl = opts?.ttl ?? 4000;
  const toast: Toast = {
    id: newId(),
    peerId,
    msg,
    ts: Date.now(),
    ttl,
    ...(opts?.kind ? { kind: opts.kind } : {}),
  };
  room.doc.getArray<Toast>(TOAST_KEY).push([toast]);
}

type Props = {
  room: YRoom | null;
  resolveName?: (peerId: string) => string | undefined;
  position?: "top" | "bottom";
  /** Render at most this many concurrent toasts (default 4). */
  maxVisible?: number;
  className?: string;
};

/**
 * Drop-in `<MeshToasts room={room}/>` component. Renders the most recent
 * non-expired toasts as a fixed-position stack. Self-prunes — no setInterval
 * cleanup duty for the app.
 */
export function MeshToasts({
  room,
  resolveName,
  position = "top",
  maxVisible = 4,
  className,
}: Props) {
  const [now, setNow] = useState(Date.now());
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!room) return;
    const arr = room.doc.getArray<Toast>(TOAST_KEY);
    const cb = () => rerender((n) => n + 1);
    arr.observe(cb);
    return () => arr.unobserve(cb);
  }, [room]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  if (!room) return null;
  const arr = room.doc.getArray<Toast>(TOAST_KEY).toArray();
  const live = arr
    .filter((t) => t.ts + t.ttl > now)
    .slice(-maxVisible)
    .reverse();

  if (live.length === 0) return null;

  return (
    <div
      className={`mesh-toasts mesh-toasts-${position} ${className ?? ""}`}
      aria-live="polite"
      aria-relevant="additions"
    >
      {live.map((t) => {
        const author = resolveName?.(t.peerId) ?? t.peerId.slice(0, 6);
        const remaining = Math.max(0, t.ts + t.ttl - now);
        const fade = remaining < 600 ? remaining / 600 : 1;
        return (
          <div
            key={t.id}
            className={`mesh-toast ${t.kind ?? ""}`}
            style={{ opacity: fade }}
          >
            <strong className="mesh-toast-author">{author}</strong>
            <span className="mesh-toast-msg">{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
