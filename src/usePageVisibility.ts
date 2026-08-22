import { useEffect, useState } from "react";

export type PageVisibility = {
  visible: boolean;
  focused: boolean;
  hiddenSince: number | null;
  hiddenForMs: number;
};

/** Local document visibility/focus state for pausing presentation-only work. */
export function usePageVisibility(): PageVisibility {
  const initialVisible = typeof document === "undefined" || document.visibilityState === "visible";
  const [visible, setVisible] = useState(initialVisible);
  const [focused, setFocused] = useState(() => typeof document === "undefined" || document.hasFocus());
  const [hiddenSince, setHiddenSince] = useState<number | null>(initialVisible ? null : Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const onVisibility = () => {
      const next = document.visibilityState === "visible";
      setVisible(next);
      setHiddenSince((previous) => next ? null : previous ?? Date.now());
      setNow(Date.now());
    };
    const onFocus = () => { setFocused(true); setNow(Date.now()); };
    const onBlur = () => { setFocused(false); setNow(Date.now()); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (!hiddenSince) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [hiddenSince]);

  return { visible, focused, hiddenSince, hiddenForMs: hiddenSince ? Math.max(0, now - hiddenSince) : 0 };
}
