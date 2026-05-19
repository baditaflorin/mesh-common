import { useEffect, useRef } from "react";

/**
 * One-shot "what's new in v0.6.0" toast on the first session after a version
 * bump. Stores `lastSeenVersion` in localStorage keyed by app name; on first
 * mount where `current !== stored`, fire the callback once. New users (no
 * stored version) get marked as "seen" without firing — they're not
 * "upgrading."
 *
 *   useChangelogToast({
 *     appName: "mesh-buzzer",
 *     version: "0.6.0",
 *     onUpgrade: (prev, next) => toast(`Updated ${prev} → ${next}: roomSeal, multi-room tabs`),
 *   });
 *
 * Discipline: maintain a one-line user-facing release note in your CHANGELOG
 * for each version bump. The toast displays whatever the caller hands it.
 */

export type ChangelogToastOptions = {
  /** The current app version (typically from package.json / config.version). */
  version: string;
  /** App identity for the storage key. Default "mesh". */
  appName?: string;
  /** Fired exactly once per upgrade (prev, next). */
  onUpgrade: (previousVersion: string, currentVersion: string) => void;
  /** localStorage prefix. Default "mesh-changelog-toast". */
  storagePrefix?: string;
  /** Skip the toast on the very first install (no prior version). Default true. */
  skipFirstInstall?: boolean;
};

export function useChangelogToast(opts: ChangelogToastOptions): void {
  const { version, appName = "mesh", onUpgrade, storagePrefix = "mesh-changelog-toast", skipFirstInstall = true } = opts;
  const fired = useRef(false);
  const onUpgradeRef = useRef(onUpgrade);
  onUpgradeRef.current = onUpgrade;

  useEffect(() => {
    if (fired.current) return;
    if (typeof localStorage === "undefined") return;
    const key = `${storagePrefix}:${appName}`;
    let prev: string | null = null;
    try {
      prev = localStorage.getItem(key);
    } catch {
      return;
    }
    if (prev === version) return;
    if (prev === null) {
      // First install — set baseline silently, unless caller wants the noise.
      try {
        localStorage.setItem(key, version);
      } catch {
        /* quota */
      }
      if (!skipFirstInstall) {
        fired.current = true;
        onUpgradeRef.current("", version);
      }
      return;
    }
    fired.current = true;
    try {
      localStorage.setItem(key, version);
    } catch {
      /* quota */
    }
    onUpgradeRef.current(prev, version);
  }, [version, appName, storagePrefix, skipFirstInstall]);
}
