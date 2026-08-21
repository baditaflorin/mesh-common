import { useCallback, useEffect, useRef, useState } from "react";

export type ClipboardOptions = {
  /** How long `copied` stays true after a successful write. Default 2 seconds. */
  copiedDurationMs?: number;
};

export type ClipboardApi = {
  /** Whether this browser has Clipboard API support or the copy fallback. */
  supported: boolean;
  /** True briefly after a successful `write`, for "Copied" feedback. */
  copied: boolean;
  /** The latest clipboard operation failure, if any. */
  error: Error | null;
  /** Copy plain text. Returns false when neither Clipboard API nor fallback succeeds. */
  write: (text: string) => Promise<boolean>;
  /** Read plain text, or null when permission/support is unavailable. */
  read: () => Promise<string | null>;
};

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const reason = error as { message?: unknown; name?: unknown };
    const normalized = new Error(
      typeof reason.message === "string" ? reason.message : fallback,
    );
    if (typeof reason.name === "string") normalized.name = reason.name;
    return normalized;
  }
  return new Error(fallback);
}

function canUseCopyFallback(): boolean {
  return typeof document !== "undefined" && typeof document.execCommand === "function";
}

function fallbackCopy(text: string): boolean {
  if (!canUseCopyFallback()) return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

/**
 * Browser clipboard read/write with a legacy copy fallback and UI-friendly
 * success/error state. Clipboard reads remain permission-gated by the browser;
 * there is no safe fallback for reading arbitrary user clipboard contents.
 */
export function useClipboard(options: ClipboardOptions = {}): ClipboardApi {
  const copiedDurationMs = options.copiedDurationMs ?? 2_000;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const clearCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      if (clearCopiedTimer.current) clearTimeout(clearCopiedTimer.current);
    },
    [],
  );

  const setCopiedForFeedback = useCallback(() => {
    if (clearCopiedTimer.current) clearTimeout(clearCopiedTimer.current);
    if (mounted.current) setCopied(true);
    clearCopiedTimer.current = setTimeout(() => {
      if (mounted.current) setCopied(false);
    }, Math.max(0, copiedDurationMs));
  }, [copiedDurationMs]);

  const write = useCallback(
    async (text: string): Promise<boolean> => {
      const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
      let clipboardError: Error | null = null;

      if (clipboard?.writeText) {
        try {
          await clipboard.writeText(text);
          if (mounted.current) setError(null);
          setCopiedForFeedback();
          return true;
        } catch (reason) {
          clipboardError = asError(reason, "Clipboard write failed");
        }
      }

      try {
        if (fallbackCopy(text)) {
          if (mounted.current) setError(null);
          setCopiedForFeedback();
          return true;
        }
      } catch (reason) {
        clipboardError = asError(reason, "Clipboard copy fallback failed");
      }

      if (mounted.current) {
        setCopied(false);
        setError(clipboardError ?? new Error("Clipboard write is not supported in this browser"));
      }
      return false;
    },
    [setCopiedForFeedback],
  );

  const read = useCallback(async (): Promise<string | null> => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard?.readText) {
      if (mounted.current) setError(new Error("Clipboard read is not supported in this browser"));
      return null;
    }

    try {
      const text = await clipboard.readText();
      if (mounted.current) setError(null);
      return text;
    } catch (reason) {
      if (mounted.current) setError(asError(reason, "Clipboard read failed"));
      return null;
    }
  }, []);

  const supported =
    (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") ||
    canUseCopyFallback();

  return { supported, copied, error, write, read };
}
