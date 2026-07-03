import { SliderControl } from "@/components/layout/SliderControl";
import { DEFAULT_EDIT_STACK } from "@/types/edits";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

export function LensPanel() {
  const lens = useDevelopStore((s) => s.edits.lens);
  const setLens = useDevelopStore((s) => s.setLens);
  const updateLens = (patch: Parameters<typeof setLens>[0]) => {
    setLens(patch);
    schedulePreviewRefresh();
  };

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      <label className="flex items-center gap-2 text-xs text-ae-text-secondary">
        <input
          type="checkbox"
          checked={lens.enable_profile}
          onChange={(e) => updateLens({ enable_profile: e.target.checked })}
          className="accent-ae-accent"
        />
        Enable Profile Corrections
      </label>
      <label className="flex items-center gap-2 text-xs text-ae-text-secondary">
        <input
          type="checkbox"
          checked={lens.chromatic_aberration > 0}
          onChange={(e) => updateLens({ chromatic_aberration: e.target.checked ? 100 : 0 })}
          className="accent-ae-accent"
        />
        Remove Chromatic Aberration
      </label>
      <p className="text-[10px] font-medium uppercase tracking-wide text-ae-text-secondary">
        Manual
      </p>
      <SliderControl
        label="Distortion"
        value={lens.distortion}
        resetValue={DEFAULT_EDIT_STACK.lens.distortion}
        min={-100}
        max={100}
        onChange={(v) => updateLens({ distortion: v })}
      />
      <SliderControl
        label="Vignetting"
        value={lens.vignette}
        resetValue={DEFAULT_EDIT_STACK.lens.vignette}
        min={-100}
        max={100}
        onChange={(v) => updateLens({ vignette: v })}
      />
    </div>
  );
}
