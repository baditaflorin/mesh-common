import * as Switch from "@radix-ui/react-switch";

export type MeshSwitchProps = {
  /** Controlled checked state. */
  checked: boolean;
  /** Toggle handler. */
  onCheckedChange: (checked: boolean) => void;
  /** Visible label rendered to the left of the switch. */
  label?: string;
  /** Optional description rendered under the label. */
  description?: string;
  /** ARIA label when no `label` is provided. */
  ariaLabel?: string;
  /** Disable the switch. */
  disabled?: boolean;
  /** Visual size. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Accessible toggle switch backed by Radix Switch. Handles Space/Enter
 * activation, focus ring, ARIA correctly.
 *
 *   <MeshSwitch
 *     checked={haptic}
 *     onCheckedChange={setHaptic}
 *     label="haptic feedback"
 *     description="vibrate on each beat"
 *   />
 */
export function MeshSwitch({
  checked,
  onCheckedChange,
  label,
  description,
  ariaLabel,
  disabled,
  size = "md",
  className,
}: MeshSwitchProps) {
  const id = `mesh-switch-${label?.replace(/\s+/g, "-").toLowerCase() ?? "noid"}`;
  const switchEl = (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={!label ? ariaLabel : undefined}
      className={`mesh-switch mesh-switch-${size}`}
    >
      <Switch.Thumb className="mesh-switch-thumb" />
    </Switch.Root>
  );
  if (!label) return <div className={className}>{switchEl}</div>;
  return (
    <label htmlFor={id} className={`mesh-switch-row ${className ?? ""}`}>
      <span className="mesh-switch-text">
        <span className="mesh-switch-label">{label}</span>
        {description && <span className="mesh-switch-description">{description}</span>}
      </span>
      {switchEl}
    </label>
  );
}
