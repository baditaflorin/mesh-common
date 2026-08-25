import { useCallback, useEffect, useRef, useState } from "react";
import {
  useFileDrop,
  type FileDrop,
  type FileDropOptions,
} from "./useFileDrop";
import { useFileShare, type FileShareOptions } from "./useFileShare";
import {
  useImageCapture,
  type CapturedImageBlob,
  type ImageCaptureOptions,
} from "./useImageCapture";
import type { YRoom } from "./useYRoom";

export type MeshMediaFlowState =
  | "idle"
  | "requesting"
  | "ready"
  | "capturing"
  | "review"
  | "sharing"
  | "error";

export type MeshMediaFlowOptions = {
  image?: Omit<ImageCaptureOptions, "armed">;
  drop?: Omit<FileDropOptions, "onFiles">;
  share?: FileShareOptions;
  /**
   * Restores an app-owned share consent choice. It never opens the camera:
   * camera acquisition must still begin from `grantConsent()` in a user gesture.
   */
  initialConsent?: boolean;
  onShared?: (fileId: string) => void;
};

export type MeshMediaFlow = {
  state: MeshMediaFlowState;
  consented: boolean;
  camera: ReturnType<typeof useImageCapture>;
  files: FileDrop;
  captured: CapturedImageBlob | null;
  error: string | null;
  /** Call from an intentional gesture before requesting camera or sharing. */
  grantConsent: () => void;
  /** Stops the camera and clears local pending media; shared files stay shared. */
  revokeConsent: () => void;
  capture: (quality?: number) => Promise<CapturedImageBlob | null>;
  shareCaptured: (name?: string) => Promise<string | null>;
  shareFile: (file: File | Blob, name?: string) => Promise<string | null>;
  discard: () => void;
};

/**
 * A deliberately explicit camera → review → share composition. It is a
 * state machine over existing primitives: captured/dropped bytes remain local
 * until a caller grants consent and invokes one of the share methods. Camera
 * tracks are stopped when consent is revoked or the component unmounts.
 */
export function useMeshMediaFlow(
  room: YRoom | null,
  options: MeshMediaFlowOptions = {},
): MeshMediaFlow {
  const [consented, setConsented] = useState(options.initialConsent ?? false);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [state, setState] = useState<MeshMediaFlowState>("idle");
  const [captured, setCaptured] = useState<CapturedImageBlob | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const mounted = useRef(true);
  const capture = useImageCapture({
    ...options.image,
    armed: consented && cameraRequested,
  });
  const files = useFileDrop(options.drop);
  const share = useFileShare(room, options.share);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!consented) return;
    if (capture.error) {
      setFlowError(capture.error);
      setState("error");
    } else if (cameraRequested && capture.ready) {
      setFlowError(null);
      setState("ready");
    }
  }, [cameraRequested, capture.error, capture.ready, consented]);

  const grantConsent = useCallback(() => {
    setFlowError(null);
    setConsented(true);
    setCameraRequested(true);
    setState("requesting");
  }, []);
  const discard = useCallback(() => {
    capture.clear();
    setCaptured(null);
    setFlowError(null);
    setState(consented && capture.ready ? "ready" : "idle");
  }, [capture, consented]);
  const revokeConsent = useCallback(() => {
    setConsented(false);
    setCameraRequested(false);
    capture.clear();
    setCaptured(null);
    files.clear();
    setFlowError(null);
    setState("idle");
  }, [capture, files]);
  const captureImage = useCallback(
    async (quality = 0.85) => {
      if (!consented) {
        setFlowError("Grant consent before capturing media.");
        setState("error");
        return null;
      }
      if (!capture.ready) {
        setFlowError("Camera is not ready yet.");
        setState("error");
        return null;
      }
      setFlowError(null);
      setState("capturing");
      const next = await capture.captureBlob(quality);
      if (!mounted.current) return null;
      if (!next) {
        setFlowError(
          capture.error ?? "This browser could not capture the image.",
        );
        setState("error");
        return null;
      }
      setCaptured(next);
      setState("review");
      return next;
    },
    [capture, consented],
  );
  const shareFile = useCallback(
    async (file: File | Blob, name?: string) => {
      if (!consented) {
        setFlowError("Grant consent before sharing media with this room.");
        setState("error");
        return null;
      }
      setFlowError(null);
      setState("sharing");
      try {
        const fileId = await share.send(file, name ? { name } : undefined);
        if (mounted.current) {
          setState("review");
          options.onShared?.(fileId);
        }
        return fileId;
      } catch (cause) {
        if (mounted.current) {
          setFlowError(
            cause instanceof Error
              ? cause.message
              : "Media could not be shared.",
          );
          setState("error");
        }
        return null;
      }
    },
    [consented, options, share],
  );
  const shareCaptured = useCallback(
    async (name = "capture.jpg") =>
      captured ? shareFile(captured.blob, name) : null,
    [captured, shareFile],
  );

  return {
    state,
    consented,
    camera: capture,
    files,
    captured,
    // A previously denied/unsupported camera should not keep a
    // consent-revoked flow visibly errored after its tracks are torn down.
    error: consented ? (flowError ?? capture.error) : flowError,
    grantConsent,
    revokeConsent,
    capture: captureImage,
    shareCaptured,
    shareFile,
    discard,
  };
}
