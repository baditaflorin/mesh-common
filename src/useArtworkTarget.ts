import { useCallback, useEffect, useMemo, useState } from "react";

export type ArtworkTargetKind = "qr" | "marker" | "reference";
export type ArtworkTarget = {
  id: string;
  label: string;
  targets: readonly { kind: ArtworkTargetKind; value: string }[];
};
export type ArtworkDetection = {
  kind: ArtworkTargetKind;
  value: string;
  confidence?: number;
  detectedAt?: number;
};
export type ArtworkTargetOptions = {
  targets: readonly ArtworkTarget[];
  minConfidence?: number;
  staleAfterMs?: number;
  now?: () => number;
};
export type ArtworkTargetState = {
  artifact: ArtworkTarget | null;
  source: ArtworkTargetKind | null;
  confidence: number | null;
  detectedAt: number | null;
  tracking: boolean;
  reportDetection: (detection: ArtworkDetection) => boolean;
  clear: () => void;
};

/**
 * Normalizes QR, fiducial-marker, and app-provided reference-image detections.
 * It does not bundle a vision model: a camera/ML adapter reports evidence and
 * this hook validates, de-duplicates, and expires the selected artwork.
 */
export function useArtworkTarget(
  options: ArtworkTargetOptions,
): ArtworkTargetState {
  const {
    targets,
    minConfidence = 0.72,
    staleAfterMs = 4_000,
    now = Date.now,
  } = options;
  const [state, setState] = useState<
    Omit<ArtworkTargetState, "reportDetection" | "clear" | "tracking">
  >({
    artifact: null,
    source: null,
    confidence: null,
    detectedAt: null,
  });
  const targetMap = useMemo(() => {
    const next = new Map<string, ArtworkTarget>();
    for (const target of targets) {
      if (!/^[a-z0-9][a-z0-9-]{1,79}$/i.test(target.id)) continue;
      for (const token of target.targets)
        next.set(`${token.kind}:${token.value.trim()}`, target);
    }
    return next;
  }, [targets]);
  const tracking =
    state.detectedAt !== null && now() - state.detectedAt <= staleAfterMs;

  useEffect(() => {
    if (!state.detectedAt) return;
    const timer = window.setInterval(
      () => {
        setState((current) =>
          current.detectedAt !== null &&
          now() - current.detectedAt > staleAfterMs
            ? {
                artifact: null,
                source: null,
                confidence: null,
                detectedAt: null,
              }
            : current,
        );
      },
      Math.max(100, Math.min(1_000, staleAfterMs)),
    );
    return () => window.clearInterval(timer);
  }, [now, staleAfterMs, state.detectedAt]);

  const reportDetection = useCallback(
    (detection: ArtworkDetection) => {
      const value = detection.value.trim();
      const confidence =
        detection.confidence ?? (detection.kind === "qr" ? 1 : 0);
      if (
        !value ||
        !Number.isFinite(confidence) ||
        confidence < minConfidence ||
        confidence > 1
      )
        return false;
      const artifact = targetMap.get(`${detection.kind}:${value}`);
      if (!artifact) return false;
      setState({
        artifact,
        source: detection.kind,
        confidence,
        detectedAt: detection.detectedAt ?? now(),
      });
      return true;
    },
    [minConfidence, now, targetMap],
  );
  const clear = useCallback(
    () =>
      setState({
        artifact: null,
        source: null,
        confidence: null,
        detectedAt: null,
      }),
    [],
  );

  return { ...state, tracking, reportDetection, clear };
}
