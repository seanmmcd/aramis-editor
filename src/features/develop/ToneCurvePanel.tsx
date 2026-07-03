import { SliderControl } from "@/components/layout/SliderControl";
import { DEFAULT_EDIT_STACK, type ParametricCurve } from "@/types/edits";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

const SLIDERS: { key: keyof ParametricCurve; label: string }[] = [
  { key: "highlights", label: "Highlights" },
  { key: "lights", label: "Lights" },
  { key: "darks", label: "Darks" },
  { key: "shadows", label: "Shadows" },
];

export function ToneCurvePanel() {
  const parametric = useDevelopStore((s) => s.edits.tone_curve.parametric);
  const setToneCurveParametric = useDevelopStore((s) => s.setToneCurveParametric);
  const photoPath = useDevelopStore((s) => s.photoPath);

  return (
    <div className="space-y-2 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to adjust the tone curve.</p>
      )}
      {SLIDERS.map(({ key, label }) => (
        <SliderControl
          key={key}
          label={label}
          value={parametric[key]}
          resetValue={DEFAULT_EDIT_STACK.tone_curve.parametric[key]}
          min={-100}
          max={100}
          disabled={!photoPath}
          onChange={(value) => {
            setToneCurveParametric(key, value);
            schedulePreviewRefresh();
          }}
        />
      ))}
    </div>
  );
}
