import { useCallback, useEffect, useState } from "react";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallPromptApi = {
  available: boolean;
  installed: boolean;
  platform: "ios" | "other";
  prompt: () => Promise<boolean>;
  dismiss: () => void;
};

/** Captures, but never auto-opens, the browser's PWA install prompt. */
export function useInstallPrompt(options: { storageKey?: string } = {}): InstallPromptApi {
  const storageKey = options.storageKey;
  const [deferred, setDeferred] = useState<DeferredInstallPrompt | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return Boolean(storageKey && localStorage.getItem(storageKey)); } catch { return false; }
  });
  const [installed, setInstalled] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches,
  );
  const platform = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "other";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const capture = (event: Event) => { event.preventDefault(); setDeferred(event as DeferredInstallPrompt); };
    const installedHandler = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installedHandler);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", installedHandler); };
  }, []);

  const prompt = useCallback(async () => {
    if (!deferred || dismissed) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
    return choice.outcome === "accepted";
  }, [deferred, dismissed]);
  const dismiss = useCallback(() => {
    setDismissed(true);
    try { if (storageKey) localStorage.setItem(storageKey, "1"); } catch { /* storage is optional */ }
  }, [storageKey]);

  return { available: Boolean(deferred) && !dismissed && !installed, installed, platform, prompt, dismiss };
}
