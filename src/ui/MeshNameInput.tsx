import { forwardRef, useId } from "react";

export type MeshNameInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  /** Visible label rendered above the input. */
  label?: string;
  /** Show "23/48" counter at the right. */
  showCounter?: boolean;
  /** Render hint text below the input. */
  hint?: string;
  /** Disable the input. */
  disabled?: boolean;
  /** Auto-focus on mount. */
  autoFocus?: boolean;
  /** Override aria-label when no `label`. */
  ariaLabel?: string;
  className?: string;
};

/**
 * Opinionated name input — collapses the 8-line
 * `<input placeholder="your name" maxLength=48 …>` boilerplate copy-pasted
 * into ~60 apps. Pairs well with `useNamedPeer` (you control the value, hook
 * handles localStorage + Y.Map publication):
 *
 *   const { name, setName } = useNamedPeer(config, room);
 *   <MeshNameInput value={name} onChange={setName} showCounter />
 */
export const MeshNameInput = forwardRef<HTMLInputElement, MeshNameInputProps>(
  function MeshNameInput(
    {
      value,
      onChange,
      placeholder = "your name",
      maxLength = 48,
      label,
      showCounter = false,
      hint,
      disabled,
      autoFocus,
      ariaLabel,
      className,
    },
    ref,
  ) {
    const inputId = useId();
    const counterId = useId();

    return (
      <div className={`mesh-name-input ${className ?? ""}`}>
        {label && (
          <div className="mesh-name-input-label">
            <label htmlFor={inputId}>{label}</label>
            {showCounter && (
              <span id={counterId} className="mesh-name-input-counter">
                {value.length}/{maxLength}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type="text"
          className="mesh-name-input-field"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-label={!label ? ariaLabel ?? placeholder : undefined}
          aria-describedby={showCounter ? counterId : undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {hint && <p className="mesh-name-input-hint">{hint}</p>}
        {!label && showCounter && (
          <span
            id={counterId}
            className="mesh-name-input-counter mesh-name-input-counter-floating"
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    );
  },
);
