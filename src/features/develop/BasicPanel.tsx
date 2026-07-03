import { SliderControl } from "@/components/layout/SliderControl";
import type { BasicEdits } from "@/types/edits";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

type BasicEditKey = keyof BasicEdits;

const SLIDERS: { key: BasicEditKey; label: string; min: number; max: number; step: number }[] = [
  { key: "temp", label: "Temp", min: 2000, max: 50000, step: 50 },
  { key: "tint", label: "Tint", min: -150, max: 150, step: 1 },
  { key: "exposure", label: "Exposure", min: -5, max: 5, step: 0.01 },
  { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1 },
  { key: "highlights", label: "Highlights", min: -100, max: 100, step: 1 },
  { key: "shadows", label: "Shadows", min: -100, max: 100, step: 1 },
  { key: "whites", label: "Whites", min: -100, max: 100, step: 1 },
  { key: "blacks", label: "Blacks", min: -100, max: 100, step: 1 },
  { key: "vibrance", label: "Vibrance", min: -100, max: 100, step: 1 },
  { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1 },
];

function fmt(key: BasicEditKey, v: number) {
  if (key === "exposure") return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
  if (key === "temp") return `${Math.round(v)} K`;
  return v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`;
}

export function BasicPanel() {
  const basic = useDevelopStore((s) => s.edits.basic);
  const setBasicEdit = useDevelopStore((s) => s.setBasicEdit);
  const photoPath = useDevelopStore((s) => s.photoPath);

  const resetValue = (key: BasicEditKey) => {
    if (key === "temp") return basic.wb_baseline_temp;
    if (key === "tint") return basic.wb_baseline_tint;
    return 0;
  };

  return (
    <div className="space-y-2 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to adjust Basic edits.</p>
      )}
      {SLIDERS.map(({ key, label, min, max, step }) => (
        <SliderControl
          key={key}
          label={label}
          value={basic[key]}
          resetValue={resetValue(key)}
          min={min}
          max={max}
          step={step}
          disabled={!photoPath}
          formatValue={(v) => fmt(key, v)}
          onChange={(v) => {
            setBasicEdit(key, v);
            schedulePreviewRefresh();
          }}
        />
      ))}
    </div>
  );
}
