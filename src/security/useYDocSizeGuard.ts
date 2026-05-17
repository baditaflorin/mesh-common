import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { YRoom } from "../useYRoom";

export type YDocSizeGuard = {
  /** Total encoded Y.Doc size in bytes (snapshot). */
  bytes: number;
  /** Human-readable size, e.g. "1.4 MB". */
  fmt: string;
  /** `bytes >= warnBytes`. */
  atRisk: boolean;
  /** `bytes >= blockBytes` — apps should refuse new writes. */
  blocked: boolean;
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Monitor the encoded size of a Y.Doc; warn at `warnBytes`, mark as
 * `blocked` past `blockBytes`. Apps should gate writes on `!guard.blocked`
 * so a hostile peer pushing junk can't drown out everyone else.
 *
 *   const guard = useYDocSizeGuard(room, { warnKB: 500, blockKB: 5_000 });
 *   const ok = !guard.blocked;
 *
 * Re-checks every `intervalMs` (default 5 s) — encoding a Y.Doc is O(N),
 * so don't poll too aggressively on large docs.
 */
export function useYDocSizeGuard(
  room: YRoom | null,
  opts?: { warnKB?: number; blockKB?: number; intervalMs?: number },
): YDocSizeGuard {
  const warnBytes = (opts?.warnKB ?? 500) * 1024;
  const blockBytes = (opts?.blockKB ?? 5_000) * 1024;
  const intervalMs = opts?.intervalMs ?? 5_000;
  const [bytes, setBytes] = useState(0);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      try {
        const update = Y.encodeStateAsUpdate(room.doc);
        setBytes(update.byteLength);
      } catch {
        /* ignore */
      }
    };
    measure();
    const id = setInterval(measure, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [room, intervalMs]);

  return {
    bytes,
    fmt: fmtBytes(bytes),
    atRisk: bytes >= warnBytes,
    blocked: bytes >= blockBytes,
  };
}
