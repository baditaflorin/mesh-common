import { useCallback, useState } from "react";
import * as Y from "yjs";
export function useCrdtSnapshot(doc: Y.Doc | null) {
  const [error, setError] = useState<Error | null>(null);
  const exportJson = useCallback(() => doc ? Y.encodeStateAsUpdate(doc) : null, [doc]);
  const restore = useCallback((update: Uint8Array) => { try { if (!doc) return false; Y.applyUpdate(doc, update); setError(null); return true; } catch (e) { setError(e instanceof Error ? e : new Error(String(e))); return false; } }, [doc]);
  return { snapshot: exportJson, exportJson, restore, error };
}
