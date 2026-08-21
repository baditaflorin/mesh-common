import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

/** A feature-owned shared type, such as a Y.Map, Y.Array, or Y.Text. */
export type CrdtUndoScope = Y.AbstractType<unknown>;

export type CrdtUndoOptions = {
  /**
   * Changes made within this window are grouped into one undo step. Defaults
   * to Yjs's 500ms. Call `stopCapturing` after a discrete gesture when a
   * shorter, explicit boundary is preferable.
   */
  captureTimeout?: number;
  /**
   * Transaction origins that should be tracked. The Yjs default (`null`)
   * captures ordinary local mutations while provider-originated remote updates
   * remain out of the local undo history.
   */
  trackedOrigins?: Set<unknown>;
  /** Do not overwrite a newer remote Y.Map value while undoing. Default false. */
  ignoreRemoteMapChanges?: boolean;
};

export type CrdtUndoApi = {
  /** Undo the latest local change in this scope. Returns whether a change applied. */
  undo: () => boolean;
  /** Reapply the latest reverted local change in this scope. Returns whether a change applied. */
  redo: () => boolean;
  /** Whether there is a local change to undo. */
  canUndo: boolean;
  /** Whether there is a reverted local change to redo. */
  canRedo: boolean;
  /** Forget undo and redo history without changing the shared document. */
  clear: () => void;
  /** Start a new undo group for the next local change. */
  stopCapturing: () => void;
};

type UndoManagerOptions = {
  captureTimeout?: number;
  trackedOrigins?: Set<unknown>;
  ignoreRemoteMapChanges?: boolean;
};

function sameScope(
  left: readonly CrdtUndoScope[],
  right: readonly CrdtUndoScope[],
): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

/**
 * Local undo/redo for one Yjs type (or a deliberately chosen set of types).
 * The scope matters: pass the feature's Y.Map, Y.Array, or Y.Text rather than
 * the whole document so undo in one control cannot roll back unrelated work.
 *
 * ```tsx
 * const notes = room.doc.getText("notes");
 * const history = useCrdtUndo(notes);
 * // history.undo(), history.redo(), history.canUndo
 * ```
 *
 * Ordinary direct Yjs mutations have origin `null`, so Yjs tracks local edits
 * by default and excludes provider-originated remote updates. For applications
 * that use custom transaction origins, pass the same origins in
 * `trackedOrigins`.
 */
export function useCrdtUndo(
  scope: CrdtUndoScope | readonly CrdtUndoScope[],
  options: CrdtUndoOptions = {},
): CrdtUndoApi {
  const scopeList = Array.isArray(scope) ? scope : [scope];
  const managerRef = useRef<Y.UndoManager | null>(null);
  const scopeRef = useRef<readonly CrdtUndoScope[]>([]);
  const optionsRef = useRef<UndoManagerOptions | null>(null);

  const managerOptions: UndoManagerOptions = {
    captureTimeout: options.captureTimeout,
    trackedOrigins: options.trackedOrigins,
    ignoreRemoteMapChanges: options.ignoreRemoteMapChanges,
  };

  // A caller commonly supplies `[map, array]` inline. Compare its members so
  // that harmless renders do not discard history; changing the actual scope or
  // manager options intentionally starts a fresh history.
  if (
    managerRef.current === null ||
    !sameScope(scopeRef.current, scopeList) ||
    optionsRef.current?.captureTimeout !== managerOptions.captureTimeout ||
    optionsRef.current?.trackedOrigins !== managerOptions.trackedOrigins ||
    optionsRef.current?.ignoreRemoteMapChanges !== managerOptions.ignoreRemoteMapChanges
  ) {
    managerRef.current = new Y.UndoManager(
      scopeList as Y.AbstractType<unknown> | Y.AbstractType<unknown>[],
      managerOptions,
    );
    scopeRef.current = scopeList;
    optionsRef.current = managerOptions;
  }

  const manager = managerRef.current;
  const [, render] = useState(0);
  const refresh = useCallback(() => render((version) => version + 1), []);

  useEffect(() => {
    const onStackChange = () => refresh();
    manager.on("stack-item-added", onStackChange);
    manager.on("stack-item-popped", onStackChange);
    manager.on("stack-item-updated", onStackChange);
    manager.on("stack-cleared", onStackChange);

    return () => {
      manager.off("stack-item-added", onStackChange);
      manager.off("stack-item-popped", onStackChange);
      manager.off("stack-item-updated", onStackChange);
      manager.off("stack-cleared", onStackChange);
      // UndoManager has no public destroy method, so remove its document
      // listener explicitly when this hook stops owning it.
      manager.doc.off("afterTransaction", manager.afterTransactionHandler);
    };
  }, [manager, refresh]);

  const undo = useCallback(() => {
    const applied = manager.undo() !== null;
    refresh();
    return applied;
  }, [manager, refresh]);

  const redo = useCallback(() => {
    const applied = manager.redo() !== null;
    refresh();
    return applied;
  }, [manager, refresh]);

  const clear = useCallback(() => {
    manager.clear();
    refresh();
  }, [manager, refresh]);

  const stopCapturing = useCallback(() => manager.stopCapturing(), [manager]);

  return {
    undo,
    redo,
    canUndo: manager.canUndo(),
    canRedo: manager.canRedo(),
    clear,
    stopCapturing,
  };
}
