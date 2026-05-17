import type { ReactNode } from "react";

export type MeshProgressBarProps = {
  /** 0..1 fraction filled. Values outside the range are clamped. */
  value: number;
  /** Label rendered above the bar. */
  label?: ReactNode;
  /** Render the fraction as a percentage to the right of the label. */
  showFraction?: boolean;
  /** Override the fraction format. Default: "62%". */
  formatFraction?: (v01: number) => string;
  /** Right-side text (e.g. "25s left"). Overrides showFraction when both supplied. */
  right?: ReactNode;
  /** Color of the fill (defaults to var(--mesh-accent)). */
  accent?: string;
  /** Visual size. */
  size?: "sm" | "md" | "lg";
  /** Indeterminate spinner-style progress (ignores value). */
  indeterminate?: boolean;
  className?: string;
};

/**
 * Progress bar with optional label + fraction. Replaces hand-rolled progress
 * UIs (storyworm slot progress, spotlight countdown, name-game timer).
 *
 *   <MeshProgressBar value={slot.progress} label="round" right={`${secondsLeft}s`}/>
 *   <MeshProgressBar value={0.4} showFraction/>
 *   <MeshProgressBar indeterminate label="connecting…"/>
 */
export function MeshProgressBar({
  value,
  label,
  showFraction = false,
  formatFraction,
  right,
  accent,
  size = "md",
  indeterminate = false,
  className,
}: MeshProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const fmt = formatFraction ?? ((v: number) => `${Math.round(v * 100)}%`);
  const rightText = right ?? (showFraction ? fmt(clamped) : null);
  return (
    <div
      className={`mesh-progressbar mesh-progressbar-${size} ${
        indeterminate ? "is-indeterminate" : ""
      } ${className ?? ""}`}
      style={accent ? ({ "--mesh-progress-accent": accent } as React.CSSProperties) : undefined}
    >
      {(label || rightText) && (
        <div className="mesh-progressbar-header">
          {label && <span className="mesh-progressbar-label">{label}</span>}
          {rightText && <span className="mesh-progressbar-right">{rightText}</span>}
        </div>
      )}
      <div
        className="mesh-progressbar-track"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="mesh-progressbar-fill"
          style={indeterminate ? undefined : { width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}
