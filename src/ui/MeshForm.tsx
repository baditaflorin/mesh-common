import {
  cloneElement,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export type MeshFormErrorValue = string | readonly string[] | null | undefined;
export type MeshFormErrors = Readonly<Record<string, MeshFormErrorValue>>;
export type MeshFormResult = void | MeshFormErrors;

export type MeshFormStatus = "idle" | "submitting" | "success" | "error";

export type MeshFormState = {
  status: MeshFormStatus;
  isSubmitting: boolean;
  errors: MeshFormErrors;
  reset: () => void;
};

const MeshFormContext = createContext<MeshFormState | null>(null);

function messagesFor(value: MeshFormErrorValue): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (Array.isArray(value))
    return value.filter(
      (message): message is string =>
        typeof message === "string" && Boolean(message),
    );
  return [];
}

function errorEntries(
  errors: MeshFormErrors,
): Array<{ field: string; message: string }> {
  return Object.entries(errors).flatMap(([field, value]) =>
    messagesFor(value).map((message) => ({ field, message })),
  );
}

function hasErrors(errors: MeshFormErrors): boolean {
  return errorEntries(errors).length > 0;
}

function firstError(
  errors: MeshFormErrors,
  field: string | undefined,
): string | undefined {
  if (!field) return undefined;
  return messagesFor(errors[field])[0];
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "We could not save your changes. Try again.";
}

/** Returns the nearest form lifecycle, or null outside `MeshForm`. */
export function useOptionalMeshForm(): MeshFormState | null {
  return useContext(MeshFormContext);
}

/** Returns the enclosing form lifecycle. */
export function useMeshForm(): MeshFormState {
  const context = useOptionalMeshForm();
  if (!context) throw new Error("useMeshForm must be used inside MeshForm");
  return context;
}

export type MeshFormProps = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "children" | "onSubmit" | "onError"
> & {
  children: ReactNode | ((state: MeshFormState) => ReactNode);
  /** Optional client-side validator. Return a field-to-message map to block submit. */
  validate?: (
    data: FormData,
    form: HTMLFormElement,
  ) => MeshFormResult | Promise<MeshFormResult>;
  /**
   * Submit handler. Return a field-to-message map for expected server/domain
   * validation failures; throw only for an unexpected failure.
   */
  onSubmit: (
    data: FormData,
    form: HTMLFormElement,
  ) => MeshFormResult | Promise<MeshFormResult>;
  /** Errors owned by an ancestor; these are merged with local validation errors. */
  errors?: MeshFormErrors;
  onSuccess?: () => void;
  onSubmitError?: (error: unknown) => void;
  /** Renders an accessible linked summary for field errors. */
  showErrorSummary?: boolean;
  errorSummaryLabel?: ReactNode;
  /** Focus the summary after a submitted validation error. */
  focusErrorSummary?: boolean;
  /** Fallback copy for a thrown submit action. */
  unexpectedErrorMessage?: string;
};

/**
 * A form coordinator for local validation and async submissions. Form values
 * remain native `FormData`, so it works without a second form-state library.
 */
export const MeshForm = forwardRef<HTMLFormElement, MeshFormProps>(
  function MeshForm(
    {
      children,
      validate,
      onSubmit,
      errors: externalErrors,
      onSuccess,
      onSubmitError,
      showErrorSummary = true,
      errorSummaryLabel = "Please fix the following",
      focusErrorSummary = true,
      unexpectedErrorMessage,
      noValidate = true,
      ...formProps
    },
    ref,
  ) {
    const [status, setStatus] = useState<MeshFormStatus>("idle");
    const [localErrors, setLocalErrors] = useState<MeshFormErrors>({});
    const submittingRef = useRef(false);
    const summaryRef = useRef<HTMLElement | null>(null);
    const [submissionAttempt, setSubmissionAttempt] = useState(0);
    const errors = useMemo<MeshFormErrors>(
      () => ({ ...localErrors, ...externalErrors }),
      [externalErrors, localErrors],
    );
    const entries = useMemo(() => errorEntries(errors), [errors]);
    const errorKey = entries
      .map(({ field, message }) => `${field}:${message}`)
      .join("|");

    useEffect(() => {
      if (focusErrorSummary && submissionAttempt > 0 && entries.length > 0) {
        summaryRef.current?.focus();
      }
    }, [entries.length, errorKey, focusErrorSummary, submissionAttempt]);

    const reset = useCallback(() => {
      if (!submittingRef.current) {
        setLocalErrors({});
        setStatus("idle");
      }
    }, []);

    const state = useMemo<MeshFormState>(
      () => ({ status, isSubmitting: status === "submitting", errors, reset }),
      [errors, reset, status],
    );

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submittingRef.current) return;

      const form = event.currentTarget;
      const data = new FormData(form);
      submittingRef.current = true;
      setSubmissionAttempt((attempt) => attempt + 1);
      setLocalErrors({});
      setStatus("submitting");

      try {
        const validationErrors = (await validate?.(data, form)) ?? {};
        if (hasErrors(validationErrors)) {
          setLocalErrors(validationErrors);
          setStatus("error");
          return;
        }

        const submissionErrors = (await onSubmit(data, form)) ?? {};
        if (hasErrors(submissionErrors)) {
          setLocalErrors(submissionErrors);
          setStatus("error");
          return;
        }

        setStatus("success");
        onSuccess?.();
      } catch (error) {
        setLocalErrors({
          _form: unexpectedErrorMessage ?? readableError(error),
        });
        setStatus("error");
        onSubmitError?.(error);
      } finally {
        submittingRef.current = false;
      }
    };

    const renderedChildren =
      typeof children === "function" ? children(state) : children;
    return (
      <MeshFormContext.Provider value={state}>
        <form
          {...formProps}
          ref={ref}
          noValidate={noValidate}
          aria-busy={state.isSubmitting || undefined}
          onSubmit={handleSubmit}
        >
          {showErrorSummary && entries.length > 0 ? (
            <section
              ref={summaryRef}
              className="mesh-form-error-summary"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              tabIndex={-1}
            >
              <strong>{errorSummaryLabel}</strong>
              <ul>
                {entries.map(({ field, message }, index) => (
                  <li key={`${field}-${message}-${index}`}>
                    {field === "_form" ? (
                      message
                    ) : (
                      <a href={`#${field}`}>{message}</a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {renderedChildren}
        </form>
      </MeshFormContext.Provider>
    );
  },
);

type FieldControlProps = {
  id?: string;
  name?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-errormessage"?: string;
};

export type MeshFieldProps = {
  children: ReactElement<FieldControlProps>;
  /** Visible label. If omitted, the control must provide its own aria-label. */
  label?: ReactNode;
  /** Explicit semantic field name. Defaults to the child control's name. */
  name?: string;
  id?: string;
  hint?: ReactNode;
  /** Overrides a matching error from the enclosing MeshForm. */
  error?: ReactNode;
  required?: boolean;
  className?: string;
};

/**
 * Couples a native field to its label, hint, error, and an optional MeshForm
 * error by `name`. It is intentionally compatible with regular inputs and
 * third-party controls that accept normal ARIA props.
 */
export function MeshField({
  children,
  label,
  name,
  id,
  hint,
  error: explicitError,
  required,
  className,
}: MeshFieldProps) {
  const generatedId = useId();
  const form = useOptionalMeshForm();
  const childName = children.props.name;
  const fieldName = name ?? childName;
  const fieldId =
    id ?? children.props.id ?? fieldName ?? `mesh-field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = `${fieldId}-error`;
  const formError = firstError(form?.errors ?? {}, fieldName);
  const error = explicitError ?? formError;
  const describedBy = [
    children.props["aria-describedby"],
    hintId,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const control = cloneElement(children, {
    id: fieldId,
    name: childName ?? name,
    required: required ?? children.props.required,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-errormessage": error ? errorId : children.props["aria-errormessage"],
  });

  return (
    <div
      className={`mesh-field ${error ? "mesh-field--invalid" : ""} ${className ?? ""}`}
    >
      {label ? (
        <label className="mesh-field-label" htmlFor={fieldId}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {control}
      {hint ? (
        <p id={hintId} className="mesh-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="mesh-field-error"
          // MeshForm already emits one concise alert summary. Announcing every
          // individual field as an alert as well is noisy for screen readers.
          role={form ? undefined : "alert"}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type MeshSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type MeshSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly MeshSelectOption[];
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Shown as a disabled first option when supplied. */
  placeholder?: string;
  ariaLabel?: string;
  fieldClassName?: string;
};

/** A mobile-friendly native select wrapped in MeshField accessibility wiring. */
export const MeshSelect = forwardRef<HTMLSelectElement, MeshSelectProps>(
  function MeshSelect(
    {
      value,
      onValueChange,
      options,
      label,
      hint,
      error,
      placeholder,
      ariaLabel,
      fieldClassName,
      required,
      ...selectProps
    },
    ref,
  ) {
    return (
      <MeshField
        label={label}
        hint={hint}
        error={error}
        required={required}
        className={fieldClassName}
      >
        <select
          {...selectProps}
          ref={ref}
          value={value}
          required={required}
          aria-label={
            label ? undefined : (ariaLabel ?? placeholder ?? "Select an option")
          }
          onChange={(event) => onValueChange(event.target.value)}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </MeshField>
    );
  },
);

export type MeshTextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "children" | "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  ariaLabel?: string;
  fieldClassName?: string;
};

/** A controlled textarea with the same label/hint/error contract as MeshSelect. */
export const MeshTextArea = forwardRef<HTMLTextAreaElement, MeshTextAreaProps>(
  function MeshTextArea(
    {
      value,
      onValueChange,
      label,
      hint,
      error,
      ariaLabel,
      fieldClassName,
      required,
      ...textAreaProps
    },
    ref,
  ) {
    return (
      <MeshField
        label={label}
        hint={hint}
        error={error}
        required={required}
        className={fieldClassName}
      >
        <textarea
          {...textAreaProps}
          ref={ref}
          value={value}
          required={required}
          aria-label={
            label
              ? undefined
              : (ariaLabel ?? textAreaProps.placeholder ?? "Text input")
          }
          onChange={(event) => onValueChange(event.target.value)}
        />
      </MeshField>
    );
  },
);

export type MeshFormSubmitProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  children: ReactNode;
  pendingLabel?: ReactNode;
};

/** A submit button that automatically blocks repeat presses while MeshForm saves. */
export function MeshFormSubmit({
  children,
  pendingLabel = "Saving…",
  disabled,
  ...props
}: MeshFormSubmitProps) {
  const form = useMeshForm();
  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || form.isSubmitting}
      aria-busy={form.isSubmitting || undefined}
    >
      {form.isSubmitting ? pendingLabel : children}
    </button>
  );
}
