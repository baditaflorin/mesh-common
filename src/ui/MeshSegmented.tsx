import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";

export type MeshSegmentedOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  /** Optional aria-label override (use when `label` is an icon). */
  ariaLabel?: string;
};

export type MeshSegmentedProps = {
  options: MeshSegmentedOption[];
  /** Controlled single-select value. */
  value: string;
  /** Toggle handler. Receives empty string if deselected (allowed only when `allowDeselect`). */
  onValueChange: (v: string) => void;
  /** Allow the user to deselect (default false — one option is always selected). */
  allowDeselect?: boolean;
  /** Visual size. */
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Single-select segmented control / chip group backed by Radix ToggleGroup.
 * Replaces ad-hoc chip rows (quiet-cheer target picker, mesh-tag avatars,
 * spyfall role display). Roving-tabindex + keyboard nav free.
 *
 *   <MeshSegmented
 *     value={target}
 *     onValueChange={setTarget}
 *     options={peers.map(([id, n]) => ({ value: id, label: n }))}
 *   />
 */
export function MeshSegmented({
  options,
  value,
  onValueChange,
  allowDeselect = false,
  size = "md",
  className,
}: MeshSegmentedProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (!v && !allowDeselect) return;
        onValueChange(v);
      }}
      className={`mesh-segmented mesh-segmented-${size} ${className ?? ""}`}
    >
      {options.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled}
          aria-label={opt.ariaLabel}
          className="mesh-segmented-item"
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
