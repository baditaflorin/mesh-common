import { useEffect, useState } from "react";
export type ScreenShareState = {
  stream: MediaStream | null;
  sharing: boolean;
  supported: boolean;
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  error: Error | null;
};
/** Display-media acquisition with track-end cleanup; no stream leaves the browser automatically. */
export function useScreenShare(): ScreenShareState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const supported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);
  const stop = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  };
  useEffect(
    () => () => {
      stream?.getTracks().forEach((track) => track.stop());
    },
    [stream],
  );
  return {
    stream,
    sharing: Boolean(stream),
    supported,
    error,
    stop,
    start: async () => {
      if (!supported) return null;
      try {
        setError(null);
        const next = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        next
          .getVideoTracks()[0]
          ?.addEventListener("ended", () => setStream(null), { once: true });
        setStream(next);
        return next;
      } catch (cause) {
        const nextError =
          cause instanceof Error ? cause : new Error("Screen share failed.");
        setError(nextError);
        return null;
      }
    },
  };
}
