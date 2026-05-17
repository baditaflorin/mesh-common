import { useCallback, useState } from "react";

export type ShareData = {
  title?: string;
  text?: string;
  url?: string;
};

export type WebShareState = {
  /** True iff Web Share API is available. */
  supported: boolean;
  /** True iff the last share attempt succeeded. */
  shared: boolean;
  /** Most recent error (e.g. user cancelled — that error is silently ignored). */
  error: string | null;
  /**
   * Trigger the native share sheet. Falls back to writing `data.url` (or
   * `text` or `title`) to the clipboard when Web Share is unavailable.
   * Returns 'shared' | 'copied' | 'error'.
   */
  share: (data: ShareData) => Promise<"shared" | "copied" | "error">;
};

/**
 * Web Share API wrapper — one-tap room-URL share to iMessage/AirDrop/etc.
 * Falls back to clipboard write so the user always gets *something* sharable.
 *
 *   const ws = useWebShare();
 *   <button onClick={() => ws.share({ title: "join the room", url: location.href })}>
 *     {ws.supported ? "share" : "copy link"}
 *   </button>
 */
export function useWebShare(): WebShareState {
  const supported =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = useCallback(
    async (data: ShareData): Promise<"shared" | "copied" | "error"> => {
      setError(null);
      try {
        if (supported) {
          await navigator.share(data);
          setShared(true);
          return "shared";
        }
        const text = data.url ?? data.text ?? data.title ?? "";
        if (text && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setShared(true);
          return "copied";
        }
        return "error";
      } catch (e) {
        // AbortError from user-cancel is not an error worth surfacing.
        const name = (e as { name?: string })?.name;
        if (name !== "AbortError") {
          setError(e instanceof Error ? e.message : String(e));
        }
        return "error";
      }
    },
    [supported],
  );

  return { supported, shared, error, share };
}
