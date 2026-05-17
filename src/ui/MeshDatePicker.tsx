import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { DayPicker } from "react-day-picker";

export type MeshDatePickerProps = {
  /** Selected date (controlled). null when no date picked. */
  value: Date | null;
  /** Setter. */
  onValueChange: (d: Date | null) => void;
  /** Placeholder text when no date is selected. */
  placeholder?: string;
  /** Visible label. */
  label?: string;
  /** Format the displayed date. Default: ISO yyyy-mm-dd. */
  formatDisplay?: (d: Date) => string;
  /** Minimum selectable date. */
  fromDate?: Date;
  /** Maximum selectable date. */
  toDate?: Date;
  /** Disabled. */
  disabled?: boolean;
  className?: string;
};

function defaultFormat(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Date picker backed by Radix Popover + react-day-picker. iOS-friendly:
 * keyboard nav, arrow keys, Enter selects. Date arithmetic via date-fns
 * (transitive dep of react-day-picker).
 *
 *   <MeshDatePicker
 *     value={dueDate}
 *     onValueChange={setDueDate}
 *     placeholder="pick a date"
 *     fromDate={new Date()}
 *   />
 */
export function MeshDatePicker({
  value,
  onValueChange,
  placeholder = "pick a date",
  label,
  formatDisplay,
  fromDate,
  toDate,
  disabled,
  className,
}: MeshDatePickerProps) {
  const [open, setOpen] = useState(false);
  const fmt = formatDisplay ?? defaultFormat;
  const displayed = value ? fmt(value) : "";
  return (
    <div className={`mesh-datepicker ${className ?? ""}`}>
      {label && <label className="mesh-datepicker-label">{label}</label>}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`mesh-datepicker-trigger ${value ? "has-value" : ""}`}
            disabled={disabled}
            aria-label={label ?? placeholder}
          >
            <span>{displayed || placeholder}</span>
            <span className="mesh-datepicker-icon" aria-hidden="true">
              📅
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={8}
            align="start"
            className="mesh-popover mesh-datepicker-popover"
          >
            <DayPicker
              mode="single"
              selected={value ?? undefined}
              onSelect={(d) => {
                onValueChange(d ?? null);
                setOpen(false);
              }}
              startMonth={fromDate}
              endMonth={toDate}
              disabled={
                fromDate || toDate
                  ? [
                      ...(fromDate ? [{ before: fromDate }] : []),
                      ...(toDate ? [{ after: toDate }] : []),
                    ]
                  : undefined
              }
              showOutsideDays
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
