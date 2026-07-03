import { CollapsibleSection } from "./CollapsibleSection";
import { SliderControl } from "./SliderControl";
import { BasicPanel } from "@/features/develop/BasicPanel";
import { CalibrationPanel } from "@/features/develop/CalibrationPanel";
import { DetailPanel } from "@/features/develop/DetailPanel";
import { EffectsPanel } from "@/features/develop/EffectsPanel";
import { HslPanel } from "@/features/develop/HslPanel";
import { LensPanel } from "@/features/develop/LensPanel";
import { ToneCurvePanel } from "@/features/develop/ToneCurvePanel";
import { SpotHealPanel } from "@/features/develop/SpotHealPanel";
import { TransformPanel } from "@/features/develop/TransformPanel";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";
import { useUIStore } from "@/stores/useUIStore";
import { DEFAULT_EDIT_STACK, fitCropToAspect, isFullCrop, type AspectRatio } from "@/types/edits";

const ASPECT_PRESETS: { label: string; value: AspectRatio | "original" | "free" }[] = [
  { label: "Original", value: "original" },
  { label: "Free", value: "free" },
  { label: "1:1", value: [1, 1] },
  { label: "4:3", value: [4, 3] },
  { label: "3:2", value: [3, 2] },
  { label: "16:9", value: [16, 9] },
];

function aspectMatches(a: AspectRatio | null, b: AspectRatio) {
  return a !== null && a[0] === b[0] && a[1] === b[1];
}

function activePreset(
  aspect: AspectRatio | null,
  crop: { x: number; y: number; width: number; height: number },
): string {
  if (aspect === null) {
    return isFullCrop(crop) ? "original" : "free";
  }
  for (const preset of ASPECT_PRESETS) {
    if (Array.isArray(preset.value) && aspectMatches(aspect, preset.value)) {
      return preset.label;
    }
  }
  return "custom";
}

export function RightPanel() {
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const cropMode = useUIStore((s) => s.cropMode);
  const pendingCrop = useUIStore((s) => s.pendingCrop);
  const setPendingCrop = useUIStore((s) => s.setPendingCrop);
  const appliedCrop = useDevelopStore((s) => s.edits.crop);
  const setCrop = useDevelopStore((s) => s.setCrop);
  const crop = cropMode && pendingCrop ? { ...appliedCrop, ...pendingCrop } : appliedCrop;
  const selectedPreset = activePreset(crop.aspect_ratio, crop);

  const applyAspectPreset = (preset: (typeof ASPECT_PRESETS)[number]) => {
    if (preset.value === "free") {
      const patch = { aspect_ratio: null as AspectRatio | null, enabled: true };
      if (cropMode) {
        setPendingCrop(patch);
      } else {
        setCrop(patch);
        schedulePreviewRefresh();
      }
      return;
    }

    if (preset.value === "original") {
      const patch = {
        aspect_ratio: null as AspectRatio | null,
        enabled: false,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      };
      if (cropMode) {
        setPendingCrop(patch);
      } else {
        setCrop(patch);
        schedulePreviewRefresh();
      }
      return;
    }

    const ratio = preset.value;
    const fitted = fitCropToAspect(crop, ratio);
    const patch = { aspect_ratio: ratio, enabled: true, ...fitted };
    if (cropMode) {
      setPendingCrop(patch);
    } else {
      setCrop(patch);
      schedulePreviewRefresh();
    }
  };

  return (
    <aside
      className="flex shrink-0 flex-col overflow-hidden border-l border-ae-border bg-ae-bg-secondary"
      style={{ width: rightPanelWidth }}
    >
      <div className="flex-1 overflow-y-auto">
        <CollapsibleSection sectionId="right-basic" title="Basic" editSectionId="basic">
          <BasicPanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-tone-curve" title="Tone Curve" editSectionId="tone_curve">
          <ToneCurvePanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-hsl-color" title="HSL / Color" editSectionId="hsl">
          <HslPanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-calibration" title="Calibration" editSectionId="calibration">
          <CalibrationPanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-crop" title="Crop" editSectionId="crop">
          <div className="space-y-2 px-3 pb-3 pt-1">
            <div>
              <p className="mb-1.5 text-xs text-ae-text-secondary">Aspect Ratio</p>
              <div className="grid grid-cols-3 gap-1">
                {ASPECT_PRESETS.map((preset) => {
                  const isActive =
                    selectedPreset ===
                    (preset.value === "free" || preset.value === "original" ? preset.value : preset.label);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyAspectPreset(preset)}
                      className={`rounded px-2 py-1 text-xs ${
                        isActive
                          ? "bg-ae-accent text-white"
                          : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <SliderControl
              label="Angle"
              value={crop.angle}
              resetValue={DEFAULT_EDIT_STACK.crop.angle}
              min={-45}
              max={45}
              onChange={(value) => {
                setCrop({ angle: value, enabled: true });
                schedulePreviewRefresh();
              }}
            />
            <SliderControl
              label="Straighten"
              value={crop.straighten}
              resetValue={DEFAULT_EDIT_STACK.crop.straighten}
              min={-45}
              max={45}
              onChange={(value) => {
                setCrop({ straighten: value, enabled: true });
                schedulePreviewRefresh();
              }}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-transform" title="Transform" editSectionId="transform">
          <TransformPanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-lens-corrections" title="Lens Corrections" editSectionId="lens">
          <LensPanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-detail" title="Detail" editSectionId="detail">
          <DetailPanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-effects" title="Effects" editSectionId="effects">
          <EffectsPanel />
        </CollapsibleSection>

        <CollapsibleSection sectionId="right-spot-heal" title="Spot Heal" editSectionId="spot_heal">
          <SpotHealPanel />
        </CollapsibleSection>
      </div>
    </aside>
  );
}
