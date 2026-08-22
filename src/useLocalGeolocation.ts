import { useCallback, useRef, useState } from "react";
export type LocalGeolocation = { supported: boolean; position: GeolocationPosition | null; error: GeolocationPositionError | null; request: () => void; clear: () => void };
/** One-shot, gesture-triggered local location lookup. Position remains in component state and is never shared. */
export function useLocalGeolocation(options: PositionOptions = {}): LocalGeolocation {
  const supported = typeof navigator !== "undefined" && Boolean(navigator.geolocation); const [position, setPosition] = useState<GeolocationPosition | null>(null); const [error, setError] = useState<GeolocationPositionError | null>(null); const latest = useRef(options); latest.current = options;
  const request = useCallback(() => { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition((next) => { setPosition(next); setError(null); }, setError, latest.current); }, []);
  return { supported, position, error, request, clear: () => { setPosition(null); setError(null); } };
}
