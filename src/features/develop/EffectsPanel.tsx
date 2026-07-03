import { SliderControl } from "@/components/layout/SliderControl";
import { DEFAULT_EDIT_STACK, type EffectsEdits } from "@/types/edits";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

type EffectKey = keyof EffectsEdits;

const VIGNETTE: { key: EffectKey; label: string; min: number; max: number }[] = [
  { key: "post_crop_vignette_amount", label: "Amount", min: -100, max: 100 },
  { key: "post_crop_vignette_midpoint", label: "Midpoint", min: 0, max: 100 },
  { key: "post_crop_vignette_roundness", label: "Roundness", min: -100, max: 100 },
  { key: "post_crop_vignette_feather", label: "Feather", min: 0, max: 100 },
];

const GRAIN: { key: EffectKey; label: string; min: number; max: number }[] = [
  { key: "grain_amount", label: "Amount", min: 0, max: 100 },
  { key: "grain_size", label: "Size", min: 0, max: 100 },
  { key: "grain_roughness", label: "Roughness", min: 0, max: 100 },
];

export function EffectsPanel() {
  const effects = useDevelopStore((s) => s.edits.effects);
  const setEffectsEdit = useDevelopStore((s) => s.setEffectsEdit);
  const photoPath = useDevelopStore((s) => s.photoPath);

  const update = (key: EffectKey, value: number) => {
    setEffectsEdit(key, value);
    schedulePreviewRefresh();
  };

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to adjust effects.</p>
      )}
      <p className="text-[10px] font-medium uppercase tracking-wide text-ae-text-secondary">
        Post-Crop Vignette
      </p>
      {VIGNETTE.map(({ key, label, min, max }) => (
        <SliderControl
          key={key}
          label={label}
          value={effects[key]}
          resetValue={DEFAULT_EDIT_STACK.effects[key]}
          min={min}
          max={max}
          disabled={!photoPath}
          onChange={(value) => update(key, value)}
        />
      ))}
      <p className="pt-1 text-[10px] font-medium uppercase tracking-wide text-ae-text-secondary">
        Grain
      </p>
      {GRAIN.map(({ key, label, min, max }) => (
        <SliderControl
          key={key}
          label={label}
          value={effects[key]}
          resetValue={DEFAULT_EDIT_STACK.effects[key]}
          min={min}
          max={max}
          disabled={!photoPath}
          onChange={(value) => update(key, value)}
        />
      ))}
    </div>
  );
}
