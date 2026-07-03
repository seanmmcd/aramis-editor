import { useCallback, useEffect, useRef, useState } from "react";

import { open } from "@tauri-apps/plugin-dialog";

import { ContextMenu, openContextMenu, type ContextMenuState } from "@/components/ContextMenu";
import { CropOverlay } from "@/features/develop/CropOverlay";
import { SpotHealOverlay } from "@/features/develop/SpotHealOverlay";
import { revealFileInExplorer } from "@/lib/revealFile";

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
  const photoId = useDevelopStore((s) => s.photoId);
  const setPhoto = useDevelopStore((s) => s.setPhoto);
  const allEditsEnabled = useDevelopStore((s) => s.allEditsEnabled);
  const toggleAllEdits = useDevelopStore((s) => s.toggleAllEdits);
  const cropMode = useUIStore((s) => s.cropMode);
  const spotHealMode = useUIStore((s) => s.spotHealMode);
  const toggleCropMode = useUIStore((s) => s.toggleCropMode);
  const toggleSpotHealMode = useUIStore((s) => s.toggleSpotHealMode);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const leftPanelVisible = useUIStore((s) => s.developLeftPanelVisible);
  const rightPanelVisible = useUIStore((s) => s.developRightPanelVisible);
  const filmstripVisible = useUIStore((s) => s.developFilmstripVisible);
  const toggleLeftPanel = useUIStore((s) => s.toggleDevelopLeftPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleDevelopRightPanel);
  const toggleFilmstrip = useUIStore((s) => s.toggleDevelopFilmstrip);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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
      if (spotHealMode) return;
      const isMiddleButton = event.button === 1;
      const isSpacePan = spaceHeld && event.button === 0;
      if (!isMiddleButton && !isSpacePan) return;

      event.preventDefault();
      panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      setIsPanning(true);
      containerRef.current?.setPointerCapture(event.pointerId);
    },
    [spaceHeld, pan.x, pan.y, spotHealMode],
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

  const handlePreviewContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (spaceHeld) {
        event.preventDefault();
        return;
      }
      if (!photoPath) return;
      openContextMenu(
        event,
        [
          { label: "Fit to window", onClick: fitToWindow },
          {
            label: cropMode ? "Exit crop mode" : "Enter crop mode",
            onClick: toggleCropMode,
          },
          {
            label: spotHealMode ? "Exit spot heal mode" : "Enter spot heal mode",
            onClick: toggleSpotHealMode,
          },
          {
            label: "Quick Export",
            onClick: () => setExportDialogOpen(true),
            disabled: photoId == null,
          },
          {
            label: "Reveal in Explorer",
            onClick: () => void revealFileInExplorer(photoPath),
          },
        ],
        setContextMenu,
      );
    },
    [spaceHeld, photoPath, photoId, cropMode, spotHealMode, fitToWindow, toggleCropMode, toggleSpotHealMode, setExportDialogOpen],
  );

  const panCursor = isPanning ? "grabbing" : spaceHeld ? "grab" : spotHealMode ? "crosshair" : "default";

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-ae-bg-primary">
      <div className="flex items-center justify-between gap-2 border-b border-ae-border px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleLeftPanel}
            className={`rounded px-2.5 py-1 text-xs ${
              leftPanelVisible
                ? "bg-ae-accent text-white"
                : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
            }`}
            title="Toggle left panel"
          >
            Left
          </button>
          <button
            type="button"
            onClick={toggleRightPanel}
            className={`rounded px-2.5 py-1 text-xs ${
              rightPanelVisible
                ? "bg-ae-accent text-white"
                : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
            }`}
            title="Toggle right panel"
          >
            Right
          </button>
          <button
            type="button"
            onClick={toggleFilmstrip}
            className={`rounded px-2.5 py-1 text-xs ${
              filmstripVisible
                ? "bg-ae-accent text-white"
                : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
            }`}
            title="Toggle filmstrip"
          >
            Filmstrip
          </button>
        </div>
        <div className="flex items-center gap-2">
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
          onClick={toggleSpotHealMode}
          disabled={spotHealMode}
          className={`rounded px-3 py-1 text-xs ${
            spotHealMode ? "bg-ae-accent text-white" : "bg-ae-bg-panel text-ae-text-primary hover:bg-ae-border"
          } disabled:cursor-default disabled:opacity-100`}
        >
          Spot Heal
        </button>
        <button
          type="button"
          onClick={handleOpenPhoto}
          className="rounded bg-ae-bg-panel px-3 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
        >
          Open Photo
        </button>
        </div>
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
        onContextMenu={handlePreviewContextMenu}
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
              ref={imageRef}
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
              onContextMenu={handlePreviewContextMenu}
            />
            {cropMode && <CropOverlay bounds={imageBounds} />}
            {spotHealMode && !cropMode && (
              <SpotHealOverlay bounds={imageBounds} imageRef={imageRef} zoom={zoom} />
            )}
          </div>
        )}
        {isPreviewLoading && previewDataUrl && (
          <div className="absolute right-4 top-4 rounded bg-ae-bg-panel px-2 py-1 text-xs text-ae-text-secondary">
            Updating full-quality preview...
          </div>
        )}
      </div>
      {contextMenu && <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />}
    </main>
  );
}
