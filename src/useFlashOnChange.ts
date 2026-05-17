import { useEffect, useRef, useState } from "react";

/**
 * Returns `true` for `durationMs` (default 400) whenever `value` changes.
 * Visual ping for remote events — quiet-cheer's "you got cheered" pulse,
 * mood-ring's hue-shift glow, applause-bracket's clap flicker.
 *
 * The first render does NOT flash (only changes after mount do). Pass a
 * stable equality function via `eq` for non-primitive comparison.
 */
export function useFlashOnChange<T>(
  value: T,
  durationMs: number = 400,
  eq: (a: T, b: T) => boolean = Object.is,
): boolean {
  const prev = useRef<T>(value);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (eq(prev.current, value)) return;
    prev.current = value;
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), durationMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, durationMs, eq]);

  return on;
}
