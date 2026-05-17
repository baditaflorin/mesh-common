import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export type MeshTab = {
  value: string;
  label: ReactNode;
  content: ReactNode;
  /** Disable the tab trigger. */
  disabled?: boolean;
};

export type MeshTabsProps = {
  tabs: MeshTab[];
  /** Controlled value. */
  value?: string;
  /** Toggle handler. */
  onValueChange?: (v: string) => void;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Tab list visual variant. */
  variant?: "underline" | "pill";
  className?: string;
};

/**
 * Accessible tabs backed by Radix Tabs. Proper roving-tabindex keyboard nav,
 * ARIA, and animation hooks come for free.
 *
 *   <MeshTabs
 *     tabs={[
 *       { value: "peer", label: "student", content: <StudentView/> },
 *       { value: "monitor", label: "teacher", content: <TeacherView/> },
 *     ]}
 *     value={role}
 *     onValueChange={setRole}
 *   />
 */
export function MeshTabs({
  tabs,
  value,
  onValueChange,
  defaultValue,
  variant = "underline",
  className,
}: MeshTabsProps) {
  return (
    <Tabs.Root
      value={value}
      defaultValue={defaultValue ?? tabs[0]?.value}
      onValueChange={onValueChange}
      className={`mesh-tabs mesh-tabs-${variant} ${className ?? ""}`}
    >
      <Tabs.List className="mesh-tabs-list" aria-label="tabs">
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            disabled={t.disabled}
            className="mesh-tabs-trigger"
          >
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Content key={t.value} value={t.value} className="mesh-tabs-content">
          {t.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
