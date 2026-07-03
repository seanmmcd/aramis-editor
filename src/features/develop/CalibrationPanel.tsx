import { SliderControl } from "@/components/layout/SliderControl";
import { DEFAULT_EDIT_STACK, type CalibrationEdits } from "@/types/edits";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

const SLIDERS: { key: keyof CalibrationEdits; label: string }[] = [
  { key: "shadow_tint", label: "Shadows Tint" },
  { key: "red_primary_hue", label: "Red Primary Hue" },
  { key: "red_primary_sat", label: "Red Primary Saturation" },
  { key: "green_primary_hue", label: "Green Primary Hue" },
  { key: "green_primary_sat", label: "Green Primary Saturation" },
  { key: "blue_primary_hue", label: "Blue Primary Hue" },
  { key: "blue_primary_sat", label: "Blue Primary Saturation" },
];

export function CalibrationPanel() {
  const calibration = useDevelopStore((s) => s.edits.calibration);
  const setCalibration = useDevelopStore((s) => s.setCalibration);
  const photoPath = useDevelopStore((s) => s.photoPath);

  return (
    <div className="space-y-2 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to adjust calibration.</p>
      )}
      {SLIDERS.map(({ key, label }) => (
        <SliderControl
          key={key}
          label={label}
          value={calibration[key]}
          resetValue={DEFAULT_EDIT_STACK.calibration[key]}
          min={-100}
          max={100}
          disabled={!photoPath}
          onChange={(value) => {
            setCalibration(key, value);
            schedulePreviewRefresh();
          }}
        />
      ))}
    </div>
  );
}
