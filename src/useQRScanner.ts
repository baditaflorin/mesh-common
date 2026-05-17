import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export type QRScanResult = {
  text: string;
  ts: number;
};

type ScanOptions = {
  onScan: (result: QRScanResult) => void;
  /** Throttle duplicate scans of the same payload within N ms (default 1500). */
  cooldownMs?: number;
};

export type QRScannerHandle = {
  videoRef: (el: HTMLVideoElement | null) => void;
  scanning: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
};

/**
 * Hook around getUserMedia + jsQR. Decodes QR codes from the device camera at
 * ~5 fps. Pass an iOS-compatible user gesture before calling start() (a button
 * click) — iOS Safari blocks getUserMedia outside of one.
 *
 * Usage:
 *
 *   const scanner = useQRScanner({ onScan: (r) => console.log(r.text) });
 *   return (
 *     <>
 *       <video ref={scanner.videoRef} muted playsInline autoPlay />
 *       <button onClick={scanner.start}>scan</button>
 *       <button onClick={scanner.stop}>stop</button>
 *     </>
 *   );
 */
export function useQRScanner(opts: ScanOptions): QRScannerHandle {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTextRef = useRef<{ text: string; ts: number } | null>(null);
  const onScanRef = useRef(opts.onScan);
  const cooldown = opts.cooldownMs ?? 1500;

  useEffect(() => {
    onScanRef.current = opts.onScan;
  }, [opts.onScan]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    if (scanning) return;
    setError(null);
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setError("camera not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoElRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      setScanning(true);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setError("canvas 2d context unavailable");
        stop();
        return;
      }

      let lastTick = 0;
      const tick = (ts: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (ts - lastTick < 200) return;
        lastTick = ts;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
        if (!video.videoWidth || !video.videoHeight) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, {
          inversionAttempts: "dontInvert",
        });
        if (code && code.data) {
          const now = Date.now();
          const last = lastTextRef.current;
          if (!last || last.text !== code.data || now - last.ts > cooldown) {
            lastTextRef.current = { text: code.data, ts: now };
            onScanRef.current({ text: code.data, ts: now });
          }
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setScanning(false);
    }
  }, [scanning, cooldown, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  return { videoRef, scanning, error, start, stop };
}

/**
 * Default base URL for the current page (origin + pathname, no query/hash).
 * In production: `https://baditaflorin.github.io/<app>/`.
 * In dev/preview: `http://localhost:5173/<app>/`.
 *
 * Always a REAL URL — the phone's native camera app opens it directly.
 */
function defaultBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin + window.location.pathname;
}

/**
 * Encode a peer + room into a QR payload. As of 2026-05-17 this is a real URL
 * — not a `mesh://` URI — so the phone's native camera app will open the live
 * app and auto-join the room via the hash params. Inside the app the deep-link
 * is consumed in `createMeshConfig` + `useIncomingScanLink`.
 *
 * Format:  `<baseUrl>#r=<roomId>&p=<peerId>&x=<extra>`
 *
 * Legacy `mesh://room/peer#extra` payloads are still accepted by
 * `parseScanPayload` for backward compatibility with any QR codes printed
 * before the URL switch.
 */
export function makeScanPayload(
  roomId: string,
  peerId: string,
  extra?: string,
  baseUrl?: string,
): string {
  const base = baseUrl ?? defaultBaseUrl();
  const params = new URLSearchParams();
  params.set("r", roomId);
  params.set("p", peerId);
  if (extra) params.set("x", extra);
  return `${base}#${params.toString()}`;
}

export type ParsedScan = {
  roomId: string;
  peerId: string;
  extra: string | null;
};

/** Parse a QR payload into room/peer/extra. Accepts either a real URL with
 * `#r=…&p=…&x=…` hash (or query string) params, or the legacy
 * `mesh://room/peer#extra` form. Returns null on mismatch. */
export function parseScanPayload(text: string): ParsedScan | null {
  const trimmed = text.trim();

  // 1) Real URL (the new format, scannable by native camera apps)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      // Try hash first (preferred — keeps payload client-side, never sent to server)
      const hashPart = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
      const params =
        hashPart && hashPart.includes("=")
          ? new URLSearchParams(hashPart)
          : url.searchParams;
      const r = params.get("r");
      const p = params.get("p");
      if (r && p) return { roomId: r, peerId: p, extra: params.get("x") };
      return null;
    } catch {
      return null;
    }
  }

  // 2) Legacy mesh:// format (kept for printed QR codes / in-app interop)
  if (trimmed.startsWith("mesh://")) {
    const rest = trimmed.slice("mesh://".length);
    const [roomAndPeer, ...extras] = rest.split("#");
    if (!roomAndPeer) return null;
    const parts = roomAndPeer.split("/");
    if (parts.length < 2) return null;
    const roomId = decodeURIComponent(parts[0]!);
    const peerId = decodeURIComponent(parts.slice(1).join("/"));
    if (!roomId || !peerId) return null;
    const extra = extras.length > 0 ? decodeURIComponent(extras.join("#")) : null;
    return { roomId, peerId, extra };
  }

  return null;
}
