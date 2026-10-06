import { useCallback, useEffect, useRef, useState } from "react";

export type MicrophoneStatus =
  "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error";

export type MicrophoneOptions = {
  constraints?: MediaTrackConstraints;
};

export type MicrophoneApi = {
  supported: boolean;
  status: MicrophoneStatus;
  stream: MediaStream | null;
  error: Error | null;
  /** Call only from an intentional visitor gesture. */
  start: () => Promise<boolean>;
  stop: () => void;
};

function asError(reason: unknown, fallback: string): Error {
  return reason instanceof Error ? reason : new Error(fallback);
}

/**
 * Explicit microphone acquisition with predictable teardown. This hook never
 * opens a permission prompt on mount; callers invoke `start()` from a button.
 */
export function useMicrophone(options: MicrophoneOptions = {}): MicrophoneApi {
  const constraints = options.constraints;
  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";
  const [status, setStatus] = useState<MicrophoneStatus>(
    supported ? "idle" : "unsupported",
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mounted = useRef(true);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (mounted.current) {
      setStream(null);
      setStatus(supported ? "idle" : "unsupported");
    }
  }, [supported]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setStatus("unsupported");
      return false;
    }
    stop();
    setError(null);
    setStatus("requesting");
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: constraints ?? true,
        video: false,
      });
      if (!mounted.current) {
        next.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = next;
      setStream(next);
      setStatus("ready");
      return true;
    } catch (reason) {
      if (mounted.current) {
        const nextError = asError(reason, "Microphone access could not start.");
        setError(nextError);
        const name = reason instanceof DOMException ? reason.name : "";
        setStatus(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : "error",
        );
      }
      return false;
    }
  }, [constraints, stop, supported]);

  return { supported, status, stream, error, start, stop };
}
