import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";

export type MeshConfirmProps = {
  /** Element that opens the confirm dialog (e.g. a button). */
  trigger: ReactNode;
  /** Title shown in the dialog. */
  title: string;
  /** Body text. */
  message?: ReactNode;
  /** Label for the confirm button (default "confirm"). */
  confirmLabel?: string;
  /** Label for the cancel button (default "cancel"). */
  cancelLabel?: string;
  /** Mark the confirm action as destructive (red). */
  destructive?: boolean;
  /** Callback fired when the user confirms. May return a promise. */
  onConfirm: () => void | Promise<void>;
  /** Optional callback when the user cancels. */
  onCancel?: () => void;
};

/**
 * Confirm dialog backed by Radix Dialog. Replaces `window.confirm` and
 * ad-hoc inline modals. Handles focus trap, ESC-to-cancel, async confirms,
 * and disabled-while-pending state automatically.
 *
 *   <MeshConfirm
 *     trigger={<button>clear all</button>}
 *     title="clear all entries?"
 *     message="this cannot be undone"
 *     destructive
 *     onConfirm={() => doClear()}
 *   />
 */
export function MeshConfirm({
  trigger,
  title,
  message,
  confirmLabel = "confirm",
  cancelLabel = "cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: MeshConfirmProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mesh-sheet-overlay" />
        <Dialog.Content className="mesh-sheet mesh-sheet-centered mesh-confirm">
          <Dialog.Title className="mesh-sheet-title">{title}</Dialog.Title>
          {message && (
            <Dialog.Description className="mesh-confirm-message">{message}</Dialog.Description>
          )}
          <div className="mesh-confirm-actions">
            <button
              type="button"
              className="mesh-btn mesh-btn-ghost"
              onClick={() => {
                setOpen(false);
                onCancel?.();
              }}
              disabled={pending}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`mesh-btn ${destructive ? "mesh-btn-danger" : "mesh-btn-primary"}`}
              onClick={handleConfirm}
              disabled={pending}
            >
              {pending ? "…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
