import { useEffect } from "react";

/** Warn before leaving while an app has unsaved local work. */
export function useBeforeUnload(when: boolean): void {
  useEffect(() => {
    if (!when || typeof window === "undefined") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}
