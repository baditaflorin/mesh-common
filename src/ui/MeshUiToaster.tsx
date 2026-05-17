import { toast, Toaster } from "sonner";

export type MeshUiToasterProps = {
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  /** Maximum simultaneous toasts. Defaults to 3. */
  visibleToasts?: number;
  /** Set to true to render close buttons. */
  closeButton?: boolean;
};

/**
 * Local UI toast layer backed by Sonner. Mount once near the app root —
 * `<MeshUiToaster/>` — then call `pushUiToast.success("copied")` from
 * anywhere.
 *
 * Distinct from `<MeshToasts/>` (the mesh-synced cross-peer announcements):
 *   - MeshToasts: shared via Yjs, every peer sees them
 *   - MeshUiToaster: local-only feedback ("copied to clipboard", "saved")
 *
 * Both can coexist in the same app.
 */
export function MeshUiToaster({
  position = "top-center",
  visibleToasts = 3,
  closeButton = false,
}: MeshUiToasterProps = {}) {
  return (
    <Toaster
      position={position}
      visibleToasts={visibleToasts}
      closeButton={closeButton}
      theme="dark"
      richColors
      toastOptions={{
        className: "mesh-ui-toast",
      }}
    />
  );
}

/**
 * Local UI toast trigger. Wraps Sonner's `toast.*` API with a consistent
 * surface and stable typing.
 */
export const pushUiToast = {
  /** Plain neutral toast. */
  show: (message: string, opts?: Parameters<typeof toast>[1]) => toast(message, opts),
  /** Green success toast. */
  success: (message: string, opts?: Parameters<typeof toast.success>[1]) =>
    toast.success(message, opts),
  /** Red error toast. */
  error: (message: string, opts?: Parameters<typeof toast.error>[1]) =>
    toast.error(message, opts),
  /** Yellow warning. */
  warning: (message: string, opts?: Parameters<typeof toast.warning>[1]) =>
    toast.warning(message, opts),
  /** Blue info. */
  info: (message: string, opts?: Parameters<typeof toast.info>[1]) =>
    toast.info(message, opts),
  /** Loading spinner toast — returns id; pass to `dismiss(id)` or `update(id, ...)`. */
  loading: (message: string, opts?: Parameters<typeof toast.loading>[1]) =>
    toast.loading(message, opts),
  /** Dismiss a specific toast by id, or all toasts when omitted. */
  dismiss: (id?: string | number) => toast.dismiss(id),
};
