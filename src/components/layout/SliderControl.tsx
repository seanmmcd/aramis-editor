import { beginInteractiveEdit, endInteractiveEdit } from "@/stores/useDevelopStore";
import { isRangeThumbHit } from "@/lib/slider";

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

  const tryThumbReset = (event: React.PointerEvent<HTMLInputElement>) => {
    if (disabled) return false;
    if (!isRangeThumbHit(event.currentTarget, event.clientX)) return false;
    if (event.detail >= 2) {
      event.preventDefault();
      handleReset();
      return true;
    }
    return false;
  };

  const displayValue = formatValue
    ? formatValue(value)
    : step < 1
      ? value.toFixed(1)
      : value > 0
        ? `+${Math.round(value)}`
        : `${Math.round(value)}`;

  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-50" : ""}`}>
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
        title="Double-click thumb to reset"
        onChange={(event) => onChange?.(Number(event.target.value))}
        onPointerDown={(event) => {
          if (disabled) return;
          if (tryThumbReset(event)) return;
          beginInteractiveEdit();
        }}
        onPointerUp={() => endInteractiveEdit()}
        onPointerCancel={() => endInteractiveEdit()}
        onDoubleClick={(event) => {
          if (disabled) return;
          if (isRangeThumbHit(event.currentTarget, event.clientX)) {
            event.preventDefault();
            handleReset();
          }
        }}
        aria-label={label}
        className="ae-slider w-full cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}
