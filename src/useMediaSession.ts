import { useCallback, useEffect, useRef } from "react";

export type MediaSessionHandlers = Partial<Record<MediaSessionAction, MediaSessionActionHandler | null>>;
export type MediaSessionApi = {
  supported: boolean;
  setMetadata: (metadata: MediaMetadataInit | null) => void;
  setPlaybackState: (state: MediaSessionPlaybackState) => void;
  setHandlers: (handlers: MediaSessionHandlers) => void;
  clear: () => void;
};

/** Safely owns Media Session metadata and action handlers for an audio-centric screen. */
export function useMediaSession(): MediaSessionApi {
  const supported = typeof navigator !== "undefined" && "mediaSession" in navigator;
  const handlers = useRef<MediaSessionHandlers>({});
  const clear = useCallback(() => {
    if (!supported) return;
    const session = navigator.mediaSession;
    Object.keys(handlers.current).forEach((action) => {
      try { session.setActionHandler(action as MediaSessionAction, null); } catch { /* unsupported action */ }
    });
    handlers.current = {};
    session.metadata = null;
    session.playbackState = "none";
  }, [supported]);
  useEffect(() => clear, [clear]);
  return {
    supported,
    setMetadata: (metadata) => {
      if (!supported) return;
      navigator.mediaSession.metadata = metadata ? new MediaMetadata(metadata) : null;
    },
    setPlaybackState: (state) => { if (supported) navigator.mediaSession.playbackState = state; },
    setHandlers: (next) => {
      if (!supported) return;
      clear();
      handlers.current = next;
      Object.entries(next).forEach(([action, handler]) => {
        try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler ?? null); } catch { /* unsupported action */ }
      });
    },
    clear,
  };
}
