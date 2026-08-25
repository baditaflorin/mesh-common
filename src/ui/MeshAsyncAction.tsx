import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export type MeshAsyncActionStatus = "idle" | "pending" | "success" | "error";

export type MeshAsyncActionState = {
  /** Current lifecycle of the most recent action. */
  status: MeshAsyncActionStatus;
  /** The rejected value from the most recent action, when one exists. */
  error: unknown | null;
  /** Starts the action. Returns false when it is already running or disabled. */
  run: () => Promise<boolean>;
  /** Clears an old success or error state before a new attempt. */
  reset: () => void;
};

export type UseMeshAsyncActionOptions = {
  /** Called at most once while an earlier invocation is pending. */
  action: () => void | Promise<void>;
  /** Prevents a new invocation while true. */
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

/**
 * Gives an async operation a small, race-safe UI lifecycle.
 *
 * It intentionally owns only local state. An action is never retried or sent
 * to peers by this hook, which keeps destructive mesh operations explicit at
 * the application boundary.
 */
export function useMeshAsyncAction({
  action,
  disabled = false,
  onSuccess,
  onError,
}: UseMeshAsyncActionOptions): MeshAsyncActionState {
  const [status, setStatus] = useState<MeshAsyncActionStatus>("idle");
  const [error, setError] = useState<unknown | null>(null);
  const actionRef = useRef(action);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  actionRef.current = action;
  successRef.current = onSuccess;
  errorRef.current = onError;

  useEffect(() => {
    // React development Strict Mode replays effects, so restore this flag on
    // every mount pass rather than leaving the hook permanently "unmounted".
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    if (!pendingRef.current && mountedRef.current) {
      setStatus("idle");
      setError(null);
    }
  }, []);

  const run = useCallback(async (): Promise<boolean> => {
    if (disabled || pendingRef.current) return false;

    pendingRef.current = true;
    if (mountedRef.current) {
      setError(null);
      setStatus("pending");
    }

    try {
      await actionRef.current();
      if (mountedRef.current) setStatus("success");
      successRef.current?.();
      return true;
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught);
        setStatus("error");
      }
      errorRef.current?.(caught);
      return false;
    } finally {
      pendingRef.current = false;
    }
  }, [disabled]);

  return { status, error, run, reset };
}

export type MeshAsyncActionProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "disabled"
> &
  UseMeshAsyncActionOptions & {
    /** Text used by the standard button before it is submitted. */
    label: ReactNode;
    /** Optional replacement while an operation is running. */
    pendingLabel?: ReactNode;
    /** Optional replacement after a successful operation. */
    successLabel?: ReactNode;
    /** Screen-reader and visible confirmation after success. */
    successMessage?: ReactNode;
    /** Formats a rejected action for the local status region. */
    errorMessage?: ReactNode | ((error: unknown) => ReactNode);
    /**
     * Custom rendering for an action that is not a conventional button.
     * The returned element is responsible for calling `state.run`.
     */
    render?: (state: MeshAsyncActionState) => ReactNode;
    /** Extra class for the status announcement. */
    statusClassName?: string;
  };

function defaultErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Try again.";
}

/**
 * A local async action button with an accessible outcome announcement.
 *
 *   <MeshAsyncAction
 *     label="Share photo"
 *     pendingLabel="Sharing…"
 *     successMessage="Photo shared"
 *     action={() => share(photo)}
 *   />
 */
export function MeshAsyncAction({
  action,
  disabled,
  onSuccess,
  onError,
  label,
  pendingLabel = "Working…",
  successLabel,
  successMessage,
  errorMessage,
  render,
  statusClassName,
  type = "button",
  ...buttonProps
}: MeshAsyncActionProps) {
  const state = useMeshAsyncAction({ action, disabled, onSuccess, onError });
  const statusId = useId();
  const isPending = state.status === "pending";
  const message =
    state.status === "success"
      ? successMessage
      : state.status === "error"
        ? typeof errorMessage === "function"
          ? errorMessage(state.error)
          : (errorMessage ?? defaultErrorMessage(state.error))
        : null;

  const buttonLabel = isPending
    ? pendingLabel
    : state.status === "success" && successLabel !== undefined
      ? successLabel
      : label;

  return (
    <span className="mesh-async-action">
      {render ? (
        render(state)
      ) : (
        <button
          {...buttonProps}
          type={type}
          disabled={disabled || isPending}
          aria-busy={isPending || undefined}
          aria-describedby={
            message ? statusId : buttonProps["aria-describedby"]
          }
          onClick={() => {
            void state.run();
          }}
        >
          {buttonLabel}
        </button>
      )}
      <span
        id={statusId}
        className={`mesh-async-action-status ${statusClassName ?? ""}`}
        role={state.status === "error" ? "alert" : "status"}
        aria-live={state.status === "error" ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {message}
      </span>
    </span>
  );
}
