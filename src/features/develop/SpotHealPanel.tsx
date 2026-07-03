import { SliderControl } from "@/components/layout/SliderControl";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { useUIStore } from "@/stores/useUIStore";
import { DEFAULT_HEAL_SPOT_RADIUS, type SpotHealMode } from "@/types/edits";

const MODES: { label: string; value: SpotHealMode }[] = [
  { label: "Heal", value: "heal" },
  { label: "Clone", value: "clone" },
];

export function SpotHealPanel() {
  const photoPath = useDevelopStore((s) => s.photoPath);
  const spots = useDevelopStore((s) => s.edits.spot_heal.spots);
  const updateHealSpot = useDevelopStore((s) => s.updateHealSpot);
  const removeHealSpot = useDevelopStore((s) => s.removeHealSpot);
  const clearHealSpots = useDevelopStore((s) => s.clearHealSpots);
  const spotHealMode = useUIStore((s) => s.spotHealMode);
  const toggleSpotHealMode = useUIStore((s) => s.toggleSpotHealMode);
  const selectedId = useUIStore((s) => s.selectedHealSpotId);
  const setSelectedHealSpotId = useUIStore((s) => s.setSelectedHealSpotId);
  const healBrushRadius = useUIStore((s) => s.healBrushRadius);
  const setHealBrushRadius = useUIStore((s) => s.setHealBrushRadius);
  const healBrushMode = useUIStore((s) => s.healBrushMode);
  const setHealBrushMode = useUIStore((s) => s.setHealBrushMode);

  const selected = spots.find((spot) => spot.id === selectedId) ?? null;
  const activeRadius = selected?.radius ?? healBrushRadius;
  const activeMode = selected?.mode ?? healBrushMode;

  const setRadius = (radius: number) => {
    if (selected) {
      updateHealSpot(selected.id, { radius });
    } else {
      setHealBrushRadius(radius);
    }
  };

  const setMode = (mode: SpotHealMode) => {
    if (selected) {
      updateHealSpot(selected.id, { mode });
    } else {
      setHealBrushMode(mode);
    }
  };

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      {!photoPath && (
        <p className="text-xs text-ae-text-secondary">Select a photo to use spot heal.</p>
      )}
      <button
        type="button"
        disabled={!photoPath}
        onClick={toggleSpotHealMode}
        className={`w-full rounded px-3 py-1.5 text-xs ${
          spotHealMode
            ? "bg-ae-accent text-white"
            : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {spotHealMode ? "Exit spot heal mode" : "Enter spot heal mode"}
      </button>
      <p className="text-xs text-ae-text-secondary">
        Click the image to place a spot. Drag the destination (center) or source (accent handle) to
        adjust. Press Delete to remove the selected spot.
      </p>
      <div>
        <p className="mb-1.5 text-xs text-ae-text-secondary">Mode</p>
        <div className="grid grid-cols-2 gap-1">
          {MODES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              disabled={!photoPath}
              onClick={() => setMode(value)}
              className={`rounded px-2 py-1 text-xs ${
                activeMode === value
                  ? "bg-ae-accent text-white"
                  : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <SliderControl
        label="Spot size"
        value={activeRadius}
        resetValue={DEFAULT_HEAL_SPOT_RADIUS}
        min={0.006}
        max={0.08}
        step={0.001}
        disabled={!photoPath}
        onChange={setRadius}
      />
      <div className="flex items-center justify-between text-xs text-ae-text-secondary">
        <span>{spots.length} spot{spots.length === 1 ? "" : "s"}</span>
        {selected && <span>Selected</span>}
      </div>
      {spots.length > 0 && (
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {spots.map((spot, index) => (
            <button
              key={spot.id}
              type="button"
              onClick={() => setSelectedHealSpotId(spot.id)}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
                spot.id === selectedId
                  ? "bg-ae-accent/20 text-ae-text-primary"
                  : "bg-ae-bg-panel text-ae-text-secondary hover:bg-ae-border"
              }`}
            >
              <span>
                Spot {index + 1} ({spot.mode})
              </span>
              <span
                role="button"
                tabIndex={0}
                className="rounded px-1 text-ae-text-secondary hover:bg-ae-border hover:text-red-400"
                onClick={(event) => {
                  event.stopPropagation();
                  removeHealSpot(spot.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    removeHealSpot(spot.id);
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!photoPath || !selected}
          onClick={() => selected && removeHealSpot(selected.id)}
          className="flex-1 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary hover:bg-ae-border disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete selected
        </button>
        <button
          type="button"
          disabled={!photoPath || spots.length === 0}
          onClick={clearHealSpots}
          className="flex-1 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-primary hover:bg-ae-border disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
