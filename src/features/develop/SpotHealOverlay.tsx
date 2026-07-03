import { useCallback, useEffect, useRef, useState } from "react";

import type { ImageBounds } from "@/features/develop/CropOverlay";
import { schedulePreviewRefresh, useDevelopStore } from "@/stores/useDevelopStore";
import { useUIStore } from "@/stores/useUIStore";
import { DEFAULT_HEAL_SOURCE_OFFSET, type HealSpot } from "@/types/edits";

type DragKind = "dest" | "source" | "radius";

interface SpotHealOverlayProps {
  bounds: ImageBounds;
  imageRef: React.RefObject<HTMLImageElement | null>;
  zoom: number;
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function pointerToNormalized(event: PointerEvent, image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

function spotPixelRadius(spot: HealSpot, bounds: ImageBounds) {
  const minDim = Math.min(bounds.width, bounds.height);
  return spot.radius * minDim;
}

export function SpotHealOverlay({ bounds, imageRef, zoom }: SpotHealOverlayProps) {
  const spots = useDevelopStore((s) => s.edits.spot_heal.spots);
  const addHealSpot = useDevelopStore((s) => s.addHealSpot);
  const updateHealSpot = useDevelopStore((s) => s.updateHealSpot);
  const removeHealSpot = useDevelopStore((s) => s.removeHealSpot);
  const selectedId = useUIStore((s) => s.selectedHealSpotId);
  const setSelectedHealSpotId = useUIStore((s) => s.setSelectedHealSpotId);
  const healBrushRadius = useUIStore((s) => s.healBrushRadius);
  const healBrushMode = useUIStore((s) => s.healBrushMode);
  const toggleSpotHealMode = useUIStore((s) => s.toggleSpotHealMode);

  const dragRef = useRef<{
    kind: DragKind;
    spotId: string;
    startNorm: { x: number; y: number };
    startSpot: HealSpot;
  } | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ spotId: string; kind: DragKind } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        toggleSpotHealMode();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        removeHealSpot(selectedId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, removeHealSpot, toggleSpotHealMode]);

  const startDrag = useCallback(
    (kind: DragKind, spot: HealSpot) => (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const image = imageRef.current;
      if (!image) return;
      setSelectedHealSpotId(spot.id);
      const startNorm = pointerToNormalized(event.nativeEvent, image);
      if (!startNorm) return;
      dragRef.current = {
        kind,
        spotId: spot.id,
        startNorm,
        startSpot: { ...spot },
      };
      setActiveDrag({ spotId: spot.id, kind });
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [setSelectedHealSpotId, imageRef],
  );

  useEffect(() => {
    if (!activeDrag) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const image = imageRef.current;
      if (!drag || !image || bounds.width <= 0 || bounds.height <= 0) return;

      const current = pointerToNormalized(event, image);
      if (!current) return;

      const dx = current.x - drag.startNorm.x;
      const dy = current.y - drag.startNorm.y;
      const spot = drag.startSpot;

      if (drag.kind === "dest") {
        updateHealSpot(drag.spotId, {
          dest_x: clamp01(spot.dest_x + dx),
          dest_y: clamp01(spot.dest_y + dy),
          source_x: clamp01(spot.source_x + dx),
          source_y: clamp01(spot.source_y + dy),
        });
      } else if (drag.kind === "source") {
        updateHealSpot(drag.spotId, {
          source_x: clamp01(spot.source_x + dx),
          source_y: clamp01(spot.source_y + dy),
        });
      } else {
        const dist = Math.hypot(
          (current.x - spot.dest_x) * bounds.width,
          (current.y - spot.dest_y) * bounds.height,
        );
        const minDim = Math.min(bounds.width, bounds.height);
        updateHealSpot(drag.spotId, {
          radius: Math.min(Math.max(dist / minDim, 0.006), 0.15),
        });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setActiveDrag(null);
      schedulePreviewRefresh({ final: true });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [activeDrag, bounds.width, bounds.height, imageRef, updateHealSpot]);

  const handleCanvasPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const image = imageRef.current;
    if (!image) return;

    const point = pointerToNormalized(event.nativeEvent, image);
    if (!point) return;

    for (const spot of [...spots].reverse()) {
      const dx = (point.x - spot.dest_x) * bounds.width;
      const dy = (point.y - spot.dest_y) * bounds.height;
      if (Math.hypot(dx, dy) <= spotPixelRadius(spot, bounds)) {
        setSelectedHealSpotId(spot.id);
        return;
      }
    }

    addHealSpot({
      dest_x: point.x,
      dest_y: point.y,
      source_x: clamp01(point.x + DEFAULT_HEAL_SOURCE_OFFSET),
      source_y: point.y,
      radius: healBrushRadius,
      mode: healBrushMode,
    });
  };

  const uiScale = 1 / Math.max(zoom, 1);
  const strokeWidth = Math.max(0.2, 0.65 * uiScale);
  const selectedStrokeWidth = Math.max(0.3, 0.85 * uiScale);
  const handleSize = Math.max(4, 7 * uiScale);
  const half = handleSize / 2;
  const dashLength = Math.max(1.5, 3 * uiScale);
  const gapLength = Math.max(1.5, 2.5 * uiScale);
  const handleBorder = Math.max(0.5, 1.25 * uiScale);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="pointer-events-auto absolute"
        style={{
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
          cursor: "crosshair",
        }}
        onPointerDown={handleCanvasPointerDown}
      />
      {spots.map((spot) => {
        const selected = spot.id === selectedId;
        const destX = bounds.x + spot.dest_x * bounds.width;
        const destY = bounds.y + spot.dest_y * bounds.height;
        const sourceX = bounds.x + spot.source_x * bounds.width;
        const sourceY = bounds.y + spot.source_y * bounds.height;
        const radiusPx = spotPixelRadius(spot, bounds);

        const isDragging = activeDrag?.spotId === spot.id;
        const dragKind = isDragging ? activeDrag.kind : null;
        const hideOverlay = isDragging;
        const hideDest = dragKind === "dest" || dragKind === "radius";
        const hideSource = dragKind === "source";

        return (
          <div key={spot.id}>
            {!hideOverlay && (
              <svg className="pointer-events-none absolute inset-0 overflow-visible" width="100%" height="100%">
                <line
                  x1={destX}
                  y1={destY}
                  x2={sourceX}
                  y2={sourceY}
                  stroke={selected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)"}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${gapLength}`}
                />
                <circle
                  cx={destX}
                  cy={destY}
                  r={radiusPx}
                  fill="none"
                  stroke={selected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)"}
                  strokeWidth={selected ? selectedStrokeWidth : strokeWidth}
                />
              </svg>
            )}
            {!hideSource && (
              <div
                className="pointer-events-auto absolute rounded-full bg-ae-accent"
                style={{
                  left: sourceX - half,
                  top: sourceY - half,
                  width: handleSize,
                  height: handleSize,
                  borderWidth: handleBorder,
                  borderStyle: "solid",
                  borderColor: "white",
                  cursor: "move",
                }}
                onPointerDown={startDrag("source", spot)}
              />
            )}
            {!hideDest && (
              <div
                className={`pointer-events-auto absolute rounded-full ${
                  selected ? "bg-white" : "bg-ae-bg-panel"
                }`}
                style={{
                  left: destX - half,
                  top: destY - half,
                  width: handleSize,
                  height: handleSize,
                  borderWidth: handleBorder,
                  borderStyle: "solid",
                  borderColor: selected ? "var(--color-ae-accent, #3b82f6)" : "white",
                  cursor: "move",
                }}
                onPointerDown={startDrag("dest", spot)}
              />
            )}
            {!hideOverlay && (
              <div
                className="pointer-events-auto absolute rounded-sm border border-white bg-ae-accent"
                style={{
                  left: destX + radiusPx - half,
                  top: destY - half,
                  width: handleSize,
                  height: handleSize,
                  borderWidth: Math.max(0.35, 0.75 * uiScale),
                  cursor: "ew-resize",
                }}
                onPointerDown={startDrag("radius", spot)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
