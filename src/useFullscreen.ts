import { useCallback, useEffect, useState, type RefObject } from "react";

export type FullscreenApi = {
  supported: boolean;
  active: boolean;
  error: Error | null;
  enter: () => Promise<boolean>;
  exit: () => Promise<boolean>;
  toggle: () => Promise<boolean>;
};

/**
 * Opt-in fullscreen control for a specific element (or the document root).
 * Browsers require `enter` to run inside a user gesture; this hook never
 * attempts that request by itself.
 */
export function useFullscreen(target?: RefObject<HTMLElement | null>): FullscreenApi {
  const supported = typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
  const [active, setActive] = useState(() => typeof document !== "undefined" && Boolean(document.fullscreenElement));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const enter = useCallback(async () => {
    if (!supported) {
      setError(new Error("Fullscreen is not supported by this browser."));
      return false;
    }
    try {
      await (target?.current ?? document.documentElement).requestFullscreen();
      setError(null);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Could not enter fullscreen."));
      return false;
    }
  }, [supported, target]);

  const exit = useCallback(async () => {
    if (!supported || !document.fullscreenElement) return false;
    try {
      await document.exitFullscreen();
      setError(null);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Could not exit fullscreen."));
      return false;
    }
  }, [supported]);

  const toggle = useCallback(() => (document.fullscreenElement ? exit() : enter()), [enter, exit]);
  return { supported, active, error, enter, exit, toggle };
}
