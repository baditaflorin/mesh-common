import { useCallback, useState } from "react";

export type NotificationApi = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  error: Error | null;
  request: () => Promise<boolean>;
  notify: (title: string, options?: NotificationOptions) => Notification | null;
};

/** Explicit, gesture-bound browser notification access. No prompt on mount. */
export function useNotification(): NotificationApi {
  const supported = typeof Notification !== "undefined";
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => supported ? Notification.permission : "unsupported");
  const [error, setError] = useState<Error | null>(null);
  const request = useCallback(async () => {
    if (!supported) return false;
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      setError(null);
      return next === "granted";
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Notification permission failed."));
      return false;
    }
  }, [supported]);
  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (!supported || permission !== "granted") return null;
    try { setError(null); return new Notification(title, options); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Notification could not be shown.")); return null; }
  }, [permission, supported]);
  return { supported, permission, error, request, notify };
}
