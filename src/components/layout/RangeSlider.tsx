import { isRangeThumbHit } from "@/lib/slider";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  resetValue?: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  resetValue,
  disabled = false,
  className = "",
  onChange,
}: RangeSliderProps) {
  const handleReset = () => {
    if (disabled || resetValue === undefined || value === resetValue) return;
    onChange(resetValue);
  };

  const tryThumbReset = (event: React.PointerEvent<HTMLInputElement>) => {
    if (disabled || resetValue === undefined) return false;
    if (!isRangeThumbHit(event.currentTarget, event.clientX)) return false;
    if (event.detail >= 2) {
      event.preventDefault();
      handleReset();
      return true;
    }
    return false;
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      title={resetValue !== undefined ? "Double-click thumb to reset" : undefined}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerDown={(event) => {
        tryThumbReset(event);
      }}
      onDoubleClick={(event) => {
        if (disabled || resetValue === undefined) return;
        if (isRangeThumbHit(event.currentTarget, event.clientX)) {
          event.preventDefault();
          handleReset();
        }
      }}
      className={`ae-slider w-full ${className}`}
    />
  );
}
