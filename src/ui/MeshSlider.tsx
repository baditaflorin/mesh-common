import * as Slider from "@radix-ui/react-slider";

export type MeshSliderProps = {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  /** Show the value (or values for range sliders) next to the label. */
  showValue?: boolean;
  /** Format the displayed value. Default: integer. */
  formatValue?: (n: number) => string;
  /** Custom CSS color for the track fill. Default: var(--mesh-accent). */
  accent?: string;
  /** ARIA label when no `label` is provided. */
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Accessible range slider backed by Radix Slider. Keyboard nav, Page Up/Down,
 * Home/End, RTL handling — all free.
 *
 *   <MeshSlider
 *     value={[myHue]}
 *     onValueChange={([v]) => setMyHue(v)}
 *     min={0} max={360} step={1}
 *     label="your hue"
 *     showValue
 *     formatValue={(n) => `${n}°`}
 *   />
 *
 * Pass a 2-element array for a range slider.
 */
export function MeshSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = false,
  formatValue,
  accent,
  ariaLabel,
  className,
  disabled,
}: MeshSliderProps) {
  const fmt = formatValue ?? ((n: number) => String(Math.round(n)));
  const valueLabel =
    value.length === 1 ? fmt(value[0]!) : value.map(fmt).join(" – ");
  return (
    <div
      className={`mesh-slider-wrap ${className ?? ""}`}
      style={accent ? ({ "--mesh-slider-accent": accent } as React.CSSProperties) : undefined}
    >
      {label && (
        <div className="mesh-slider-header">
          <span className="mesh-slider-label">{label}</span>
          {showValue && <span className="mesh-slider-value">{valueLabel}</span>}
        </div>
      )}
      <Slider.Root
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={!label ? ariaLabel : undefined}
        className="mesh-slider"
      >
        <Slider.Track className="mesh-slider-track">
          <Slider.Range className="mesh-slider-range" />
        </Slider.Track>
        {value.map((_, i) => (
          <Slider.Thumb key={i} className="mesh-slider-thumb" />
        ))}
      </Slider.Root>
    </div>
  );
}
