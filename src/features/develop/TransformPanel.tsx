import { SliderControl } from "@/components/layout/SliderControl";
import { IconRotateLeft, IconRotateRight } from "@/components/icons";
import { DEFAULT_EDIT_STACK, type TransformEdits } from "@/types/edits";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";

const SLIDERS: { key: keyof TransformEdits; label: string }[] = [
  { key: "vertical", label: "Vertical" },
  { key: "horizontal", label: "Horizontal" },
  { key: "aspect", label: "Aspect" },
  { key: "scale", label: "Scale" },
  { key: "x_offset", label: "X Offset" },
  { key: "y_offset", label: "Y Offset" },
];

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function TransformPanel() {
  const transform = useDevelopStore((s) => s.edits.transform);
  const setTransform = useDevelopStore((s) => s.setTransform);
  const photoPath = useDevelopStore((s) => s.photoPath);

  const rotateBy = (delta: number) => {
    setTransform("rotate", normalizeDegrees(transform.rotate + delta));
    schedulePreviewRefresh();
  };

  const resetRotation = () => {
    setTransform("rotate", 0);
    schedulePreviewRefresh();
  };

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to adjust transform.</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ae-text-secondary">
          Rotate
          {transform.rotate !== 0 && (
            <span className="ml-1 text-ae-muted">({Math.round(transform.rotate)}°)</span>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!photoPath}
            onClick={() => rotateBy(-90)}
            className="inline-flex items-center gap-1 rounded bg-ae-bg-panel px-2.5 py-1 text-xs text-ae-text-primary hover:bg-ae-border disabled:opacity-40"
            title="Rotate 90 degrees left (counter-clockwise)"
          >
            <IconRotateLeft />
            <span>90</span>
          </button>
          <button
            type="button"
            disabled={!photoPath}
            onClick={() => rotateBy(90)}
            className="inline-flex items-center gap-1 rounded bg-ae-bg-panel px-2.5 py-1 text-xs text-ae-text-primary hover:bg-ae-border disabled:opacity-40"
            title="Rotate 90 degrees right (clockwise)"
          >
            <IconRotateRight />
            <span>90</span>
          </button>
          {transform.rotate !== 0 && (
            <button
              type="button"
              disabled={!photoPath}
              onClick={resetRotation}
              className="rounded px-2 py-1 text-xs text-ae-text-secondary hover:text-ae-text-primary disabled:opacity-40"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      {SLIDERS.map(({ key, label }) => (
        <SliderControl
          key={key}
          label={label}
          value={transform[key]}
          resetValue={DEFAULT_EDIT_STACK.transform[key]}
          min={-100}
          max={100}
          disabled={!photoPath}
          onChange={(v) => {
            setTransform(key, v);
            schedulePreviewRefresh();
          }}
        />
      ))}
    </div>
  );
}
