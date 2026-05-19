import { useEffect, useMemo, useRef } from "react";
import { useAwareness } from "./useAwareness";
import type { YRoom } from "./useYRoom";

/**
 * "alice is typing…" awareness-backed helper. Wire `bump()` to your input's
 * onChange (or onKeyDown). It auto-clears `idleAfterMs` after the last bump.
 *
 *   const { typing, bump, names } = useTypingIndicator(room, { name: nick });
 *   return (
 *     <>
 *       <input onChange={(e) => { setText(e.target.value); bump(); }} />
 *       {typing.length > 0 && <p>{describe(names)} is typing…</p>}
 *     </>
 *   );
 *
 * Self is excluded from `typing` / `names`. Idle expiry is tracked locally per
 * observer — there's no clock-skew issue.
 */

export type TypingIndicatorState = {
  /** peerIds of others currently typing. */
  typing: string[];
  /** Optional display names of others currently typing (when provided). */
  names: string[];
  /** Call from your input handlers. Re-extends the local "typing" window. */
  bump: () => void;
  /** Force-clear the local typing state (e.g. on submit). */
  stop: () => void;
};

export type TypingIndicatorOptions = {
  /** Display name to broadcast alongside the typing flag. */
  name?: string;
  /** ms of idle before the local peer is considered no-longer-typing. Default 2_500. */
  idleAfterMs?: number;
  /** ms between awareness updates during sustained typing. Default 1_000. */
  resendIntervalMs?: number;
};

type TypingState = { typing: boolean; name?: string; at: number };

export function useTypingIndicator(
  room: YRoom | null,
  opts?: TypingIndicatorOptions,
): TypingIndicatorState {
  const idleAfterMs = opts?.idleAfterMs ?? 2_500;
  const resendMs = opts?.resendIntervalMs ?? 1_000;
  const name = opts?.name;

  const awareness = useAwareness<TypingState>(room);
  const lastBump = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const stop = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (isTyping.current) {
      isTyping.current = false;
      awareness.setLocal({ typing: false, name, at: Date.now() });
    }
  };

  const bump = () => {
    const now = Date.now();
    const dt = now - lastBump.current;
    lastBump.current = now;

    if (!isTyping.current || dt >= resendMs) {
      isTyping.current = true;
      awareness.setLocal({ typing: true, name, at: now });
    }

    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      isTyping.current = false;
      awareness.setLocal({ typing: false, name, at: Date.now() });
    }, idleAfterMs);
  };

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const { typing, names } = useMemo(() => {
    const t: string[] = [];
    const n: string[] = [];
    const cutoff = Date.now() - idleAfterMs * 2;
    for (const [peerId, s] of awareness.peers.entries()) {
      if (!s?.typing) continue;
      if (typeof s.at === "number" && s.at < cutoff) continue;
      t.push(peerId);
      if (s.name) n.push(s.name);
    }
    return { typing: t, names: n };
  }, [awareness.peers, idleAfterMs]);

  return { typing, names, bump, stop };
}
