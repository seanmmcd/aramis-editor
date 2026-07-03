import { SliderControl } from "@/components/layout/SliderControl";
import { DEFAULT_EDIT_STACK, type HslEdits } from "@/types/edits";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

const COLOR_BANDS = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"];

const CHANNELS: { key: keyof HslEdits; label: string; min: number; max: number }[] = [
  { key: "hue", label: "Hue", min: -100, max: 100 },
  { key: "saturation", label: "Saturation", min: -100, max: 100 },
  { key: "luminance", label: "Luminance", min: -100, max: 100 },
];

export function HslPanel() {
  const hsl = useDevelopStore((s) => s.edits.hsl);
  const setHslChannel = useDevelopStore((s) => s.setHslChannel);
  const photoPath = useDevelopStore((s) => s.photoPath);

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to adjust HSL.</p>
      )}
      {CHANNELS.map(({ key, label, min, max }) => (
        <div key={key}>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ae-text-secondary">
            {label}
          </p>
          {COLOR_BANDS.map((color, index) => (
            <SliderControl
              key={`${key}-${color}`}
              label={color}
              value={hsl[key][index]}
              resetValue={DEFAULT_EDIT_STACK.hsl[key][index]}
              min={min}
              max={max}
              disabled={!photoPath}
              onChange={(value) => {
                setHslChannel(key, index, value);
                schedulePreviewRefresh();
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
