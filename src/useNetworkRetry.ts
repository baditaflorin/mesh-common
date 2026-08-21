import { useCallback, useState } from "react";
export function useNetworkRetry<T>(task: () => Promise<T>, opts?: { maxAttempts?: number }) {
  const [attempts, setAttempts] = useState(0); const [pending, setPending] = useState(false); const [error, setError] = useState<Error | null>(null);
  const run = useCallback(async () => { setPending(true); setError(null); try { const value = await task(); setAttempts(0); return value; } catch (e) { setAttempts((n) => n + 1); const err = e instanceof Error ? e : new Error(String(e)); setError(err); throw err; } finally { setPending(false); } }, [task]);
  return { run, retry: run, attempts, pending, error, exhausted: attempts >= (opts?.maxAttempts ?? 3) };
}
