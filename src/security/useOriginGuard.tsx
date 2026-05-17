import { useEffect, useState } from "react";

export type OriginGuardState = {
  /** Current origin, or "(unknown)" in non-browser contexts. */
  origin: string;
  /** True iff origin matches one of `allow`. */
  trusted: boolean;
  /** True iff we are inside an iframe (potential clickjacking). */
  framed: boolean;
  /** Composite: needs warning UI if !trusted OR framed. */
  warn: boolean;
};

const DEFAULT_ALLOW = [
  /^https:\/\/[a-z0-9-]+\.github\.io$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * Detect that the app is loaded under an unexpected origin (phishing clone)
 * or inside an iframe (clickjacking surface). Renders best-effort:
 * `warn` is true when something looks off.
 *
 * Pair with `<OriginWarningBanner/>` (caller-built) to inform users:
 *   const guard = useOriginGuard();
 *   guard.warn && <p>⚠ Loaded from {guard.origin} (unexpected)</p>
 *
 * Honest scope: a hostile clone can simply remove this banner from source.
 * It defends against accidental "I forgot we cloned this" lookalikes, not
 * sophisticated phishing.
 */
export function useOriginGuard(opts?: { allow?: Array<RegExp | string> }): OriginGuardState {
  const allow = opts?.allow ?? DEFAULT_ALLOW;
  const [state, setState] = useState<OriginGuardState>(() => ({
    origin: typeof window === "undefined" ? "(unknown)" : window.location.origin,
    trusted: false,
    framed: false,
    warn: false,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const trusted = allow.some((p) =>
      typeof p === "string" ? p === origin : p.test(origin),
    );
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      // Cross-origin frame access throws — that's itself a signal that we
      // are framed.
      framed = true;
    }
    setState({
      origin,
      trusted,
      framed,
      warn: !trusted || framed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
