import { useCallback, useEffect, useRef, useState } from "react";

import { open } from "@tauri-apps/plugin-dialog";

import { CropOverlay } from "@/features/develop/CropOverlay";

import type { ImageBounds } from "@/features/develop/CropOverlay";

import { EditToggleEye } from "@/components/layout/EditToggleEye";

import { useDevelopStore } from "@/stores/useDevelopStore";

import { useUIStore } from "@/stores/useUIStore";

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const ZOOM_WHEEL_FACTOR = 0.0012;

function computeObjectContainBounds(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): ImageBounds {
  if (imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, width: containerW, height: containerH };
  }

  const scale = Math.min(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;

  return {
    x: (containerW - width) / 2,
    y: (containerH - height) / 2,
    width,
    height,
  };
}

function clampZoom(value: number) {
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
}

export function CanvasArea() {
  const previewDataUrl = useDevelopStore((s) => s.previewDataUrl);
  const previewDimensions = useDevelopStore((s) => s.previewDimensions);
  const isPreviewLoading = useDevelopStore((s) => s.isPreviewLoading);
  const previewError = useDevelopStore((s) => s.previewError);
  const photoPath = useDevelopStore((s) => s.photoPath);
  const setPhoto = useDevelopStore((s) => s.setPhoto);
  const allEditsEnabled = useDevelopStore((s) => s.allEditsEnabled);
  const toggleAllEdits = useDevelopStore((s) => s.toggleAllEdits);
  const cropMode = useUIStore((s) => s.cropMode);
  const toggleCropMode = useUIStore((s) => s.toggleCropMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const fitToWindow = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setImageNaturalSize({ width: 0, height: 0 });
    fitToWindow();
  }, [photoPath, fitToWindow]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpaceHeld(false);
        setIsPanning(false);
        panStartRef.current = null;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const imageW = imageNaturalSize.width || previewDimensions?.width || 0;
  const imageH = imageNaturalSize.height || previewDimensions?.height || 0;
  const imageBounds = computeObjectContainBounds(containerSize.width, containerSize.height, imageW, imageH);
  const transformOriginX = imageBounds.x + imageBounds.width / 2;
  const transformOriginY = imageBounds.y + imageBounds.height / 2;

  const zoomRef = useRef({ zoom, pan, transformOriginX, transformOriginY, imageBoundsWidth: imageBounds.width });
  zoomRef.current = { zoom, pan, transformOriginX, transformOriginY, imageBoundsWidth: imageBounds.width };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !previewDataUrl) return;

    const onWheel = (event: WheelEvent) => {
      const { zoom: currentZoom, pan: currentPan, transformOriginX: originX, transformOriginY: originY, imageBoundsWidth } =
        zoomRef.current;
      if (imageBoundsWidth <= 0) return;

      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const nextZoom = clampZoom(currentZoom * Math.exp(-event.deltaY * ZOOM_WHEEL_FACTOR));
      if (nextZoom === currentZoom) return;

      const imageCenterX = originX + currentPan.x;
      const imageCenterY = originY + currentPan.y;
      const offsetX = mouseX - imageCenterX;
      const offsetY = mouseY - imageCenterY;
      const scale = nextZoom / currentZoom;

      setPan({
        x: currentPan.x + offsetX * (1 - scale),
        y: currentPan.y + offsetY * (1 - scale),
      });
      setZoom(nextZoom);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [previewDataUrl]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const isMiddleButton = event.button === 1;
      const isSpacePan = spaceHeld && event.button === 0;
      if (!isMiddleButton && !isSpacePan) return;

      event.preventDefault();
      panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      setIsPanning(true);
      containerRef.current?.setPointerCapture(event.pointerId);
    },
    [spaceHeld, pan.x, pan.y],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const start = panStartRef.current;
      if (!start || !isPanning) return;

      setPan({
        x: start.panX + (event.clientX - start.x),
        y: start.panY + (event.clientY - start.y),
      });
    },
    [isPanning],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (!panStartRef.current) return;
    panStartRef.current = null;
    setIsPanning(false);
    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleOpenPhoto = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "tif", "tiff", "nef", "cr2", "dng"] }],
    });

    if (typeof selected === "string") {
      await setPhoto(selected);
    }
  };

  const panCursor = isPanning ? "grabbing" : spaceHeld ? "grab" : "default";

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-ae-bg-primary">
      <div className="flex items-center justify-end gap-2 border-b border-ae-border px-4 py-2">
        <EditToggleEye
          enabled={allEditsEnabled}
          onClick={toggleAllEdits}
          title={allEditsEnabled ? "Hide all edits (before/after)" : "Show all edits"}
          className="px-1"
        />
        <span className="text-xs text-ae-text-secondary">
          {allEditsEnabled ? "Edits on" : "Before"}
        </span>
        <button
          type="button"
          onClick={toggleCropMode}
          disabled={cropMode}
          className={`rounded px-3 py-1 text-xs ${
            cropMode ? "bg-ae-accent text-white" : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
          } disabled:cursor-default disabled:opacity-100`}
        >
          Crop
        </button>
        <button
          type="button"
          onClick={handleOpenPhoto}
          className="rounded bg-ae-bg-panel px-3 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
        >
          Open Photo
        </button>
      </div>
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden p-4"
        style={{ cursor: panCursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={fitToWindow}
        onContextMenu={(event) => {
          if (spaceHeld) event.preventDefault();
        }}
      >
        {!photoPath && <p className="select-none text-sm text-ae-text-secondary">No photo selected</p>}
        {photoPath && !previewDataUrl && !previewError && (
          <p className="select-none text-sm text-ae-text-secondary">
            {isPreviewLoading ? "Rendering full-quality preview..." : "Adjust edits to preview"}
          </p>
        )}
        {previewError && <p className="max-w-md text-center text-sm text-red-400">{previewError}</p>}
        {previewDataUrl && imageBounds.width > 0 && (
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: `${transformOriginX}px ${transformOriginY}px`,
            }}
          >
            <img
              src={previewDataUrl}
              alt="Develop preview"
              className="absolute shadow-lg"
              style={{
                left: imageBounds.x,
                top: imageBounds.y,
                width: imageBounds.width,
                height: imageBounds.height,
              }}
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                fitToWindow();
              }}
            />
            {cropMode && <CropOverlay bounds={imageBounds} />}
          </div>
        )}
        {isPreviewLoading && previewDataUrl && (
          <div className="absolute right-4 top-4 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-secondary">
            Updating full-quality preview...
          </div>
        )}
      </div>
    </main>
  );
}
