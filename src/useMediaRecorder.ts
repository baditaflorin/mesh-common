import { useEffect, useRef, useState } from "react";
export type MediaRecorderState = {
  status: "idle" | "recording" | "paused" | "stopped" | "error";
  elapsedMs: number;
  blob: Blob | null;
  error: Error | null;
  start: (stream: MediaStream, options?: MediaRecorderOptions) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};
/** Safe MediaRecorder lifecycle; caller owns stream acquisition and permissions. */
export function useMediaRecorder(): MediaRecorderState {
  const recorder = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const [status, setStatus] = useState<MediaRecorderState["status"]>("idle");
  const [elapsedMs, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (status === "recording") setElapsed(Date.now() - started.current);
    }, 250);
    return () => {
      clearInterval(timer);
      recorder.current?.state !== "inactive" && recorder.current?.stop();
    };
  }, [status]);
  const stop = () =>
    recorder.current?.state !== "inactive" && recorder.current?.stop();
  return {
    status,
    elapsedMs,
    blob,
    error,
    start: (stream, options) => {
      if (
        typeof MediaRecorder === "undefined" ||
        recorder.current?.state === "recording"
      )
        return;
      try {
        const chunks: BlobPart[] = [];
        const next = new MediaRecorder(stream, options);
        recorder.current = next;
        next.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        next.onstop = () => {
          setBlob(new Blob(chunks, { type: next.mimeType }));
          setStatus("stopped");
        };
        next.onerror = () => {
          setError(new Error("Recording failed."));
          setStatus("error");
        };
        started.current = Date.now();
        setElapsed(0);
        setBlob(null);
        next.start();
        setStatus("recording");
      } catch (cause) {
        setError(
          cause instanceof Error ? cause : new Error("Recording failed."),
        );
        setStatus("error");
      }
    },
    pause: () => {
      recorder.current?.pause();
      setStatus("paused");
    },
    resume: () => {
      recorder.current?.resume();
      setStatus("recording");
    },
    stop,
  };
}
