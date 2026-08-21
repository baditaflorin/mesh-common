import { useCallback, useState } from "react";

export type HapticPattern = number | number[];
export type HapticPatternApi = {
  supported: boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  vibrate: (pattern?: HapticPattern) => boolean;
  cancel: () => boolean;
};

/** Vibration with an explicit, local user preference (off by default only when previously disabled). */
export function useHapticPattern(storageKey = "mesh:haptics"): HapticPatternApi {
  const supported = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const [enabled, setEnabledState] = useState(() => {
    try { return localStorage.getItem(storageKey) !== "off"; } catch { return true; }
  });
  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try { localStorage.setItem(storageKey, next ? "on" : "off"); } catch { /* unavailable storage */ }
    if (!next && supported) navigator.vibrate(0);
  }, [storageKey, supported]);
  const vibrate = useCallback((pattern: HapticPattern = 60) => {
    if (!supported || !enabled) return false;
    try { return navigator.vibrate(pattern); } catch { return false; }
  }, [enabled, supported]);
  const cancel = useCallback(() => {
    if (!supported) return false;
    try { return navigator.vibrate(0); } catch { return false; }
  }, [supported]);
  return { supported, enabled, setEnabled, vibrate, cancel };
}
