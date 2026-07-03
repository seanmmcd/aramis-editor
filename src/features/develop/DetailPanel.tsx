import { DEFAULT_EDIT_STACK, type DetailEdits } from "@/types/edits";
import { SliderControl } from "@/components/layout/SliderControl";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

type SliderDef = {
  key: keyof DetailEdits;
  label: string;
  min: number;
  max: number;
  step?: number;
};

const SHARPENING: SliderDef[] = [
  { key: "sharpening_amount", label: "Amount", min: 0, max: 150 },
  { key: "sharpening_radius", label: "Radius", min: 0.5, max: 3, step: 0.1 },
  { key: "sharpening_detail", label: "Detail", min: 0, max: 100 },
  { key: "sharpening_masking", label: "Masking", min: 0, max: 100 },
];

const NOISE: SliderDef[] = [
  { key: "noise_reduction_luminance", label: "Luminance", min: 0, max: 100 },
  { key: "noise_reduction_detail", label: "Detail", min: 0, max: 100 },
  { key: "noise_reduction_contrast", label: "Contrast", min: 0, max: 100 },
  { key: "noise_reduction_color", label: "Color", min: 0, max: 100 },
];

export function DetailPanel() {
  const detail = useDevelopStore((s) => s.edits.detail);
  const setDetailEdit = useDevelopStore((s) => s.setDetailEdit);
  const photoPath = useDevelopStore((s) => s.photoPath);

  const update = (key: keyof DetailEdits, value: number) => {
    setDetailEdit(key, value);
    schedulePreviewRefresh();
  };

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to adjust detail.</p>
      )}
      <p className="text-[10px] font-medium uppercase tracking-wide text-ae-text-secondary">
        Sharpening
      </p>
      {SHARPENING.map(({ key, label, min, max, step }) => (
        <SliderControl
          key={key}
          label={label}
          value={detail[key]}
          resetValue={DEFAULT_EDIT_STACK.detail[key]}
          min={min}
          max={max}
          step={step ?? 1}
          disabled={!photoPath}
          onChange={(v) => update(key, v)}
        />
      ))}
      <p className="pt-1 text-[10px] font-medium uppercase tracking-wide text-ae-text-secondary">
        Noise Reduction
      </p>
      {NOISE.map(({ key, label, min, max }) => (
        <SliderControl
          key={key}
          label={label}
          value={detail[key]}
          resetValue={DEFAULT_EDIT_STACK.detail[key]}
          min={min}
          max={max}
          disabled={!photoPath}
          onChange={(v) => update(key, v)}
        />
      ))}
    </div>
  );
}
