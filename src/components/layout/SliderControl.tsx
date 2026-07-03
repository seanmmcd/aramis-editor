import { beginInteractiveEdit, endInteractiveEdit } from "@/stores/useDevelopStore";

interface SliderControlProps {
  label: string;
  value?: number;
  /** Value restored on double-click (defaults to 0). */
  resetValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  onChange?: (value: number) => void;
}

export function SliderControl({
  label,
  value = 0,
  resetValue = 0,
  min = -100,
  max = 100,
  step = 1,
  disabled = false,
  formatValue,
  onChange,
}: SliderControlProps) {
  const handleReset = () => {
    if (disabled || value === resetValue) return;
    onChange?.(resetValue);
  };

  const displayValue = formatValue
    ? formatValue(value)
    : step < 1
      ? value.toFixed(1)
      : value > 0
        ? `+${Math.round(value)}`
        : `${Math.round(value)}`;

  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-50" : ""}`} title="Double-click to reset">
      <div
        className="flex cursor-default select-none items-center justify-between"
        onDoubleClick={(event) => {
          event.preventDefault();
          handleReset();
        }}
      >
        <label className="text-xs text-ae-text-secondary">{label}</label>
        <span className="min-w-[2.5rem] text-right text-xs tabular-nums text-ae-text-secondary">
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(Number(event.target.value))}
        onPointerDown={(event) => {
          if (disabled) return;
          // Range inputs often skip dblclick in WebView2; detail === 2 is the second mousedown.
          if (event.detail >= 2) {
            event.preventDefault();
            handleReset();
            return;
          }
          beginInteractiveEdit();
        }}
        onPointerUp={() => endInteractiveEdit()}
        onPointerCancel={() => endInteractiveEdit()}
        aria-label={label}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ae-border accent-ae-accent disabled:cursor-not-allowed"
      />
    </div>
  );
}
