import { useCallback, useEffect, useState, type RefObject } from "react";
export type PointerLockApi = { supported: boolean; locked: boolean; error: Error | null; request: () => Promise<boolean>; exit: () => void };
/** Explicit pointer-lock controls for keyboard/mouse game canvases. */
export function usePointerLock(target: RefObject<HTMLElement | null>): PointerLockApi {
  const supported = typeof document !== "undefined" && "pointerLockElement" in document;
  const [locked, setLocked] = useState(false); const [error, setError] = useState<Error | null>(null);
  useEffect(() => { const update = () => setLocked(document.pointerLockElement === target.current); const fail = () => setError(new Error("Pointer lock was denied.")); document.addEventListener("pointerlockchange", update); document.addEventListener("pointerlockerror", fail); return () => { document.removeEventListener("pointerlockchange", update); document.removeEventListener("pointerlockerror", fail); }; }, [target]);
  const request = useCallback(async () => { if (!supported || !target.current) return false; try { await target.current.requestPointerLock(); setError(null); return true; } catch (reason) { setError(reason instanceof Error ? reason : new Error("Could not lock pointer.")); return false; } }, [supported, target]);
  return { supported, locked, error, request, exit: () => { if (document.pointerLockElement) document.exitPointerLock(); } };
}
