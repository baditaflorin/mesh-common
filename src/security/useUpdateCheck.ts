import { useEffect, useState } from "react";

export type UpdateCheckState = {
  /** Current version (passed in by the app at build time). */
  current: string;
  /** Latest published version from mesh-common, when fetched. */
  latest: string | null;
  /** True iff `latest > current` (semver-ish string compare). */
  outdated: boolean;
  /** ms since the last fetch attempt. */
  lastCheckedMs: number;
  /** Most recent error (network failure). */
  error: string | null;
  /** Force a re-check. */
  refresh: () => void;
};

const DEFAULT_URL =
  "https://raw.githubusercontent.com/baditaflorin/mesh-common/main/package.json";

function semverGT(a: string, b: string): boolean {
  const ap = a.split(/[.-]/).map((x) => Number(x) || x);
  const bp = b.split(/[.-]/).map((x) => Number(x) || x);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

/**
 * Periodically poll the mesh-common GitHub raw `package.json` for a newer
 * version. When `outdated` becomes true, apps should prompt the user to
 * hard-refresh — the only way to push a security patch without a Service
 * Worker.
 *
 *   const u = useUpdateCheck({ current: __APP_VERSION__ });
 *   {u.outdated && (
 *     <button onClick={() => location.reload()}>
 *       update available: v{u.latest} (you have v{u.current})
 *     </button>
 *   )}
 *
 * Honest scope: fetches GitHub raw with no auth and no caching directive,
 * so an adversary can MITM the response if they control the network.
 * For most use cases this is fine because it only triggers a UI prompt,
 * not auto-execution.
 */
export function useUpdateCheck(opts: {
  /** App version (typically `__APP_VERSION__` injected at build time). */
  current: string;
  /** URL to fetch package.json from. Default: mesh-common GitHub raw. */
  url?: string;
  /** Polling interval. Default 1 hour. */
  intervalMs?: number;
  /** Skip the first check (useful in tests). */
  skipFirst?: boolean;
}): UpdateCheckState {
  const url = opts.url ?? DEFAULT_URL;
  const intervalMs = opts.intervalMs ?? 60 * 60 * 1000;
  const [latest, setLatest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (opts.skipFirst) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const pkg = (await res.json()) as { version?: string };
        if (cancelled) return;
        if (typeof pkg.version === "string") {
          setLatest(pkg.version);
          setError(null);
        }
        setLastCheckedAt(Date.now());
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLastCheckedAt(Date.now());
        }
      }
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs, tick]);

  return {
    current: opts.current,
    latest,
    outdated: latest != null && semverGT(latest, opts.current),
    lastCheckedMs: lastCheckedAt === 0 ? 0 : Date.now() - lastCheckedAt,
    error,
    refresh: () => setTick((n) => n + 1),
  };
}
