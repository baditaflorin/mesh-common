import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export type MeshSheetProps = {
  /** Controlled open state. */
  open: boolean;
  /** Toggle handler — receives the next open state. */
  onOpenChange: (open: boolean) => void;
  /** Sheet title (also used as ARIA label). */
  title: string;
  /** Optional description rendered below the title. */
  description?: ReactNode;
  /** Sheet body. */
  children: ReactNode;
  /** Optional footer (e.g. action buttons). */
  footer?: ReactNode;
  /** Bottom sheet (mobile) vs centered dialog (default). */
  variant?: "centered" | "bottom";
  /** Additional class for the panel. */
  className?: string;
};

/**
 * Bottom-sheet / modal dialog backed by Radix Dialog. Handles focus trap,
 * scroll lock, ESC-to-close, and outside-click-to-close out of the box.
 *
 *   <MeshSheet open={open} onOpenChange={setOpen} title="settings">
 *     <p>content</p>
 *   </MeshSheet>
 */
export function MeshSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = "centered",
  className,
}: MeshSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="mesh-sheet-overlay" />
        <Dialog.Content
          className={`mesh-sheet mesh-sheet-${variant} ${className ?? ""}`}
        >
          <header className="mesh-sheet-header">
            <Dialog.Title className="mesh-sheet-title">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="mesh-sheet-description">
                {description}
              </Dialog.Description>
            )}
            <Dialog.Close className="mesh-sheet-close" aria-label="close">
              ×
            </Dialog.Close>
          </header>
          <div className="mesh-sheet-body">{children}</div>
          {footer && <footer className="mesh-sheet-footer">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
