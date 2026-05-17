import { useCallback } from "react";

export type VibrationState = {
  /** True iff `navigator.vibrate` exists (Android Chrome). iOS Safari: false. */
  supported: boolean;
  /** Trigger a vibration. No-op if unsupported. */
  vibrate: (pattern?: number | number[]) => boolean;
  /** Stop any vibration. */
  stop: () => boolean;
};

/**
 * Wrapper for `navigator.vibrate`. iOS Safari does NOT support Vibration —
 * the wrapper exposes `.supported` so apps can audio-cue (e.g. via
 * useAudioCue) as a fallback in one branch instead of duplicating gating
 * logic in every call site.
 *
 *   const v = useVibration();
 *   onSuccess = () => v.supported ? v.vibrate([100, 50, 100]) : playDing();
 */
export function useVibration(): VibrationState {
  const supported =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const vibrate = useCallback(
    (pattern: number | number[] = 60): boolean => {
      if (!supported) return false;
      try {
        return navigator.vibrate(pattern);
      } catch {
        return false;
      }
    },
    [supported],
  );
  const stop = useCallback((): boolean => {
    if (!supported) return false;
    try {
      return navigator.vibrate(0);
    } catch {
      return false;
    }
  }, [supported]);
  return { supported, vibrate, stop };
}
