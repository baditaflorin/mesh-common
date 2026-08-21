import { useCallback, useEffect, useRef, useState } from "react";

export type IdleDetectorState = { idle: boolean; idleForMs: number; reset: () => void };
export type IdleDetectorOptions = { timeoutMs?: number; events?: readonly string[] };

/** Local interaction-idle state; does not request the privacy-sensitive browser Idle Detection permission. */
export function useIdleDetector({ timeoutMs = 60_000, events = ["pointerdown", "keydown", "touchstart", "scroll"] }: IdleDetectorOptions = {}): IdleDetectorState {
  const lastActive = useRef(Date.now());
  const [now, setNow] = useState(lastActive.current);
  const [, rerender] = useState(0);
  const reset = useCallback(() => {
    lastActive.current = Date.now();
    setNow(lastActive.current);
    // A pointer event can arrive in the same millisecond as the interval tick;
    // force a render so `idle` cannot remain stale in that edge case.
    rerender((version) => version + 1);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), Math.min(Math.max(250, timeoutMs / 4), 1_000));
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => { clearInterval(timer); events.forEach((event) => window.removeEventListener(event, reset)); };
  }, [events, reset, timeoutMs]);
  const idleForMs = Math.max(0, now - lastActive.current);
  return { idle: idleForMs >= timeoutMs, idleForMs, reset };
}
