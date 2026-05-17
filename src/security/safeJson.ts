/**
 * Hardened JSON.parse with size + depth + array/object cardinality caps.
 *
 * Many mesh-* apps call `JSON.parse(...)` on user-pasted text (QR payloads,
 * import strings). Plain JSON.parse will gladly chew through a multi-MB,
 * deeply nested, billion-laughs-style payload and hang the tab.
 *
 *   const result = safeJson(pasted, { maxBytes: 64_000, maxDepth: 16 });
 *   if (!result.ok) return showError(result.reason);
 *   useThe(result.value);
 */
export type SafeJsonOk<T> = { ok: true; value: T };
export type SafeJsonErr = { ok: false; reason: "too-large" | "too-deep" | "too-wide" | "malformed" | "empty" };
export type SafeJsonResult<T> = SafeJsonOk<T> | SafeJsonErr;

export type SafeJsonOptions = {
  /** Max raw string length. Default 1 MB. */
  maxBytes?: number;
  /** Max nesting depth. Default 32. */
  maxDepth?: number;
  /** Max array length OR object key count per node. Default 10_000. */
  maxWidth?: number;
};

/**
 * Validate that a parsed JSON value does not exceed depth/width caps.
 * Walks the tree recursively (stack-bounded by `maxDepth`).
 */
function walk(node: unknown, depth: number, maxDepth: number, maxWidth: number): SafeJsonErr | null {
  if (depth > maxDepth) return { ok: false, reason: "too-deep" };
  if (node == null) return null;
  if (typeof node !== "object") return null;
  if (Array.isArray(node)) {
    if (node.length > maxWidth) return { ok: false, reason: "too-wide" };
    for (const item of node) {
      const err = walk(item, depth + 1, maxDepth, maxWidth);
      if (err) return err;
    }
    return null;
  }
  const keys = Object.keys(node);
  if (keys.length > maxWidth) return { ok: false, reason: "too-wide" };
  for (const k of keys) {
    const err = walk((node as Record<string, unknown>)[k], depth + 1, maxDepth, maxWidth);
    if (err) return err;
  }
  return null;
}

export function safeJson<T = unknown>(
  input: unknown,
  opts: SafeJsonOptions = {},
): SafeJsonResult<T> {
  const maxBytes = opts.maxBytes ?? 1_048_576;
  const maxDepth = opts.maxDepth ?? 32;
  const maxWidth = opts.maxWidth ?? 10_000;
  if (input == null) return { ok: false, reason: "empty" };
  const raw = String(input);
  if (!raw.trim()) return { ok: false, reason: "empty" };
  if (raw.length > maxBytes) return { ok: false, reason: "too-large" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const err = walk(parsed, 0, maxDepth, maxWidth);
  if (err) return err;
  return { ok: true, value: parsed as T };
}
