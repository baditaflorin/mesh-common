import type { YRoom } from "./useYRoom";
import { useExpiringClaim } from "./useExpiringClaim";

/** A soft, expiring single-actor lock for facilitator controls and turns. */
export function useTurnLock(
  room: YRoom | null,
  key: string,
  opts?: { ttlMs?: number; tickMs?: number },
) {
  const claim = useExpiringClaim(room, `turn-lock:${key}`, opts?.ttlMs ?? 30_000, {
    tickMs: opts?.tickMs,
  });
  return { ...claim, holder: claim.claimedBy, acquire: claim.claim, renew: claim.refresh };
}
