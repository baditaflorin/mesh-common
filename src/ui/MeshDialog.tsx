import type { ReactNode } from "react";
import { MeshSheet } from "./MeshSheet";

export type MeshDialogProps = {
  /** Controlled open state. */
  open: boolean;
  /** Receives the next open state, including Escape and outside clicks. */
  onOpenChange: (open: boolean) => void;
  /** Required accessible dialog title. */
  title: string;
  /** Optional text that describes the dialog's purpose. */
  description?: ReactNode;
  /** Dialog contents. */
  children: ReactNode;
  /** Optional actions, conventionally buttons. */
  footer?: ReactNode;
  /** Additional class applied to the dialog panel. */
  className?: string;
};

/**
 * A centered, accessible modal dialog for shared app chrome.
 *
 * This is intentionally a small semantic facade over `MeshSheet`: it keeps
 * every dialog on the Radix focus-trapping, Escape-to-close implementation
 * while making the intended desktop/modal use explicit. Use `MeshSheet` for
 * a bottom-sheet presentation.
 *
 *   <MeshDialog open={open} onOpenChange={setOpen} title="Share room">
 *     <InviteLink />
 *   </MeshDialog>
 */
export function MeshDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: MeshDialogProps) {
  return (
    <MeshSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
      variant="centered"
      className={className}
    >
      {children}
    </MeshSheet>
  );
}
