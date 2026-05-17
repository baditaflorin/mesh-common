import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

export type MeshPopoverProps = {
  /** Element that opens the popover (e.g. button, info icon). */
  trigger: ReactNode;
  /** Popover content. */
  children: ReactNode;
  /** Initial placement. */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Distance in px from the trigger edge. */
  sideOffset?: number;
  /** Show the little arrow pointing to the trigger. */
  showArrow?: boolean;
  /** Controlled open state (optional). */
  open?: boolean;
  /** Controlled open setter (optional). */
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

/**
 * Floating popover backed by Radix Popover (which uses Floating UI under the
 * hood). Use for tooltips, "more options" menus, info pops, settings panels.
 *
 *   <MeshPopover trigger={<button>?</button>} side="bottom">
 *     <p>this is a hint</p>
 *   </MeshPopover>
 */
export function MeshPopover({
  trigger,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  showArrow = true,
  open,
  onOpenChange,
  className,
}: MeshPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={`mesh-popover ${className ?? ""}`}
        >
          {children}
          {showArrow && <Popover.Arrow className="mesh-popover-arrow" />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
